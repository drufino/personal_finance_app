import { observable, computed, createTransformer, autorun, IObservableArray, ObservableMap } from 'mobx';
import { QIFTransactionDetails, DateFormat } from './QIF';
import { SerializedDataInfo, SerializedData, AccountSerializedData, serialize } from './AccountSerializedData';
import * as QIF from './QIF';

export type AccountType = 'Cash' | 'Credit';

export type RawData =
{
    uploaded     : Date;
    transactions : QIFTransactionDetails[];
    date_format  : DateFormat;
};

export type SummaryView =
{
    excluded_categories : string[],
    income_categories : string[],
    cash_only         : boolean
};

export type Transaction = 
{
    date : Date,
    who  : string,
    amount : number,
    category : string | null
};

// NB matches against the 'raw' data
type CategoryOverride = [{date : string,who:string, amount:number}, string];

export type AccountData = 
{
    uploaded_data   : RawData[],
    readonly category_filter : ObservableMap<string>;
    readonly category_override : IObservableArray<CategoryOverride>;
    initial_balance : number;
    account_type    : AccountType;
};

type AccountInfo =
{
    readonly name            : string;
    readonly category_filter : ObservableMap<string>;
    readonly initial_balance : number;
    readonly account_type    : AccountType;
}


export type Transactions = Transaction[];

function remove_whitespace(s : string) : string
{
    return s.replace(/\s{2,}/g, ' ');
}
export function get_category(x : QIFTransactionDetails, category_filter : ObservableMap<string>, category_override : CategoryOverride[]) : string | null
{
    let category : string | null = null;

    let who_removed_whitespace = remove_whitespace(x.who);

    category_filter.forEach((v,k) => {
        if (!category && who_removed_whitespace.search(k) > -1)
        {
            category = v;
        }
    });

    category_override.forEach((y) => {
        if (y[0].who === x.who && y[0].amount === x.amount && y[0].date === x.date)
        {
            category = y[1];
        }
    });

    return category;
}
export function date_range(x : RawData) : [Date|string,Date|string] | null {
    let dates = x.transactions.map((y) => {
        let z = QIF.normalize_date(y.date,x.date_format);
        if (z == null) {
            return y.date;
        }
        else{
            return z;
        }
    });
    dates.sort((a,b) => {
        if ((a instanceof Date) && !(b instanceof Date))
        {
            return -1;
        }
        else if (!(a instanceof Date) && (b instanceof Date))
        {
            return 1;
        }
        else
        {
            return a < b ? -1 : 1;
        }
    });
    if (dates.length == 0) { return null }
    return [dates[0], dates[dates.length-1]];
}

export class AccountDataStore
{
    private readonly raw_account_data = observable.map<AccountData>();
    private readonly _summary_view = observable.object<SummaryView>(
        { excluded_categories:[], income_categories:[], cash_only : false } );

    @computed get transfers() {
        console.log('transfers');
        let these_transfers : [string,Transaction][] = [];
        this.raw_account_data.forEach((v,k) => {
            let these_transactions = this.extract_account_transactions_(this.raw_account_data, k);
            these_transactions.forEach((v) => {
                if (v.category == 'Transfer' || v.category == 'Credit Card Payment')
                {
                    these_transfers.push([k,v]);
                }
            });
        });

        these_transfers.sort((a,b) => (a[1].date < b[1].date) ? -1 : 1);

        let matched_transfers: [string, Transaction, string, Transaction][] = [];
       
        for (var i = 0; i < these_transfers.length; ++i)
        {
            let x = these_transfers[i];
            for (var j = i; j < these_transfers.length; ++j)
            {
                let y = these_transfers[j];
                if (y[1].category != x[1].category)
                    continue;
                if ((y[1].date.valueOf() - x[1].date.valueOf())/8.64e7 > 4.0)
                    continue;  
                if (y[1].amount + x[1].amount == 0.0)
                {
                    matched_transfers.push([x[0],x[1],y[0],y[1]]);
                }
            }
        }

        return matched_transfers;
    }

    @computed get account_names() {
        return this.raw_account_data.keys();
    }

    @computed get income_categories() : [string[], string[]] {
        let all_categories : string[] = [];
        let expense_categories : string[] = [];
        let possible_income_categories : string[] = [];
        this.all_transactions.forEach((v) => {
            if (v.amount > 0.0 && v.category && possible_income_categories.indexOf(v.category) == -1)
                possible_income_categories.push(v.category);
            if (v.amount < 0.0 && v.category && expense_categories.indexOf(v.category) == -1)
                expense_categories.push(v.category)
            if (v.category && all_categories.indexOf(v.category) == -1)
            {
                all_categories.push(v.category);
            }
        });

        let income_categories : string []= [];
        all_categories.forEach((v) => {
            if (expense_categories.indexOf(v) == -1)
            {
                income_categories.push(v);
            }
        });
        return [income_categories, possible_income_categories];
    }

    @computed get inferred_income_categories() {
        return this.income_categories[0];
    }

    @computed get summary_view() : Readonly<SummaryView> { 
        let res = 
            {
              excluded_categories : [...this._summary_view.excluded_categories],
              income_categories : [...this.inferred_income_categories],
              cash_only : this._summary_view.cash_only
            };
        this._summary_view.income_categories.forEach((v) => {
            if (res.income_categories.indexOf(v) == -1)
            {
                res.income_categories.push(v);
            }
        });
        return res;
    }

    public update_summary_view(summary_view : Partial<SummaryView>) {
        if (summary_view.excluded_categories)
        {
            this._summary_view.excluded_categories = [...summary_view.excluded_categories];
        }
        if (summary_view.income_categories)
        {
            this._summary_view.income_categories = [...summary_view.income_categories];
        }
        if (summary_view.cash_only != undefined)
        {
            this._summary_view.cash_only = summary_view.cash_only;
        }
    }

    categories = createTransformer((account_name : string) => {
        let res : string[] = [];

        let update = (category : string) => {
            if (res.indexOf(category) == -1)
            {
                res.push(category);
            }
        }

        let account_data = this.raw_account_data.get(account_name);
        if (account_data) {
            account_data.category_filter.values().map(update);
            account_data.category_override.map((x) => update(x[1]));
        }
        res.sort((x,y) => x.localeCompare(y));
        return res;
    });

    @computed get all_categories() : string[] {
        let res : string[] = [];

        let update = (category : string) => {
            if (res.indexOf(category) == -1)
            {
                res.push(category);
            }
        }

        this.raw_account_data.forEach((account_data,k) => {
            account_data.category_filter.values().map(update);
            account_data.category_override.map((x) => update(x[1]));
        });

        res.sort((x,y) => x.localeCompare(y));

        return res;
    }

    @computed get accounts() : AccountInfo[] {
        let accounts : AccountInfo[] = [];
        this.raw_account_data.forEach((v,k) => {
            accounts.push({
                name : k,
                category_filter : v.category_filter,
                initial_balance : v.initial_balance,
                account_type : v.account_type
            });
        });
        return accounts;
    }

    get_account_info = createTransformer((account_name : string) => {
        let account_data = this.raw_account_data.get(account_name);
        if (!account_data)
        {
            return null;
        }
        else
        {
            return { name : account_name, category_filter : account_data.category_filter, initial_balance : account_data.initial_balance, account_type : account_data.account_type };
        }
    });

    /*
    @computed private get transactions_() {
        let res = observable.map<Transaction[]>();
        this.raw_account_data.keys().map((account_name) => {
            res.set(account_name,this.extract_account_transactions_(this.raw_account_data, account_name));
        });
        return res;
    };*/

    public is_duplicate(account_name : string, this_transaction : QIF.QIFTransactionDetails)
    {
        let account_data = this.raw_account_data.get(account_name);
        if (account_data)
        {
            for (var i = 0; i < account_data.uploaded_data.length; ++i)
            {
                let uploaded_data = account_data.uploaded_data[i];
                for (var j = 0; j < uploaded_data.transactions.length; ++j)
                {
                    let transaction = uploaded_data.transactions[j];
                    if (transaction.date !== this_transaction.date || transaction.amount !== this_transaction.amount)
                        continue;
                    if (remove_whitespace(transaction.who) == remove_whitespace(this_transaction.who))
                    {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    get_transactions = createTransformer((account_name : string) => {
        return this.extract_account_transactions_(this.raw_account_data, account_name);
    });

    get_all_transactions = createTransformer((args : {cash_only : boolean}) => {
        console.log('Calling get_all_transactions');
        let total : Transactions = [];

        this.raw_account_data.keys().map((account_name) => {
            let account_info = this.get_account_info(account_name);
            if (!account_info || (account_info.account_type == 'Credit' && args.cash_only))
            {
                return;
            }
            let these_transactions = this.extract_account_transactions_(this.raw_account_data, account_name);
            these_transactions.map((x) => { total.push(x); });
        });

        total.sort((x,y) => (x.date < y.date) ? -1 : 1);

        return total;
    });

    @computed get all_transactions() {
        console.log('Calling all_transactions');
        let total : Transactions = [];

        this.raw_account_data.keys().map((account_name) => {
            let these_transactions = this.extract_account_transactions_(this.raw_account_data, account_name);
            these_transactions.map((x) => { total.push(x); });
        });

        total.sort((x,y) => (x.date < y.date) ? -1 : 1);

        return total;
    }

    public setInitialBalance(account_name : string, balance : number)
    {
        let account_data = this.raw_account_data.get(account_name);
        if (account_data)
        {
            account_data.initial_balance = balance;
        }
    }

    public findAccount(account_name : string) : AccountInfo | undefined
    {
        let account_data = this.raw_account_data.get(account_name);
        if (account_data)
        {
            return {
                name : account_name, 
                initial_balance : account_data.initial_balance,
                category_filter : account_data.category_filter,
                account_type : account_data.account_type
            };
        }
        else
        {
            return undefined;
        }
    }

    balance(data : Transactions)
    {
        return data.map((x) => x.amount).reduce((a,b) => (a+b), 0.0);
    }

    public getRawData(account_name : string) : AccountData | undefined
    {
        return this.raw_account_data.get(account_name);
    }

    public extract_account_transactions(account_name : string) : Transactions
    {
        return this.extract_account_transactions_(this.raw_account_data, account_name);
    }

    private find_raw_transaction(account_name : string, transaction : Transaction) : QIFTransactionDetails | undefined
    {
        let account = this.getRawData(account_name);
        if (account)
        {
            var matched_transaction = undefined;
            for (var i = 0; i < account.uploaded_data.length && !matched_transaction; ++i)
            {
                let data = account.uploaded_data[i];
                let s_date = QIF.to_string(transaction.date, data.date_format);
                for (var j = 0; j < data.transactions.length && !matched_transaction; ++j)
                {
                    let qif_transaction = data.transactions[j];

                    if (qif_transaction.date == s_date && qif_transaction.amount == transaction.amount && remove_whitespace(qif_transaction.who) === remove_whitespace(transaction.who))
                    {
                        matched_transaction = qif_transaction;
                    }
                }
            }
            return matched_transaction;
        }
        else
        {
            return undefined;
        }
    }
    public categorize(account_name : string, transaction : Transaction, category_name : string)
    {
        if (transaction.category === category_name) return;

        let account = this.getRawData(account_name);
        if (account)
        {
            var raw_transaction = this.find_raw_transaction(account_name, transaction);
            if (raw_transaction)
            {
                var raw_transaction_ = raw_transaction;

                let index = account.category_override.findIndex((y) => {
                    return y[0].who == transaction.who && y[0].amount == transaction.amount && y[0].date === raw_transaction_.date;
                });

                if (index > -1)
                {
                    if (category_name == '')
                    {
                        account.category_override.slice(index,1);
                    }
                    else
                    {
                        account.category_override[index][1] = category_name;
                    }
                }
                else
                {
                    if (category_name != '')
                        account.category_override.push([{who:raw_transaction_.who, date:raw_transaction_.date, amount : raw_transaction_.amount},category_name]);
                }
            }
        }
    }
    private extract_account_transactions_(data : ObservableMap<AccountData>, account_name : string) : Transactions
    {
        console.log('Calling extract_account_transactions');
        let account_data_ = data.get(account_name);
        if (account_data_)
        {
            let account_data = account_data_;
            let transactions : Transactions = [];
            let missed_transactions : number = 0;

            account_data.uploaded_data.map((x) => {
                x.transactions.map((y : QIFTransactionDetails) => {
                    let this_date = QIF.normalize_date(y.date, x.date_format);

                    if (this_date)
                    {
                        let transaction : Transaction = {
                            date : this_date,
                            who : remove_whitespace(y.who),
                            amount : y.amount,
                            category : ''
                        };
                        let category = get_category(y, account_data.category_filter, account_data.category_override);
                        transactions.push({...transaction, category : category});
                    }
                    else
                    {
                        missed_transactions++;
                    }
                });
            });

            transactions.sort((x,y) => (x.date < y.date) ? 1 : -1);
            return transactions;
        }
        else
        {
            return [];
        }
    }

    public load_data(accountSerialized : SerializedData)
    {
        let account_info = accountSerialized.account_info;
        if (account_info)
        {
            this.load_data_info(account_info);
        }

        if (accountSerialized.summary_view)
        {
            let exclude_categories = accountSerialized.summary_view.excluded_categories;

            let income_categories = accountSerialized.summary_view.income_categories;
            if (!income_categories)
            {
                income_categories = ['Salary'];
            }

            this.update_summary_view({ excluded_categories : exclude_categories, income_categories : income_categories});
        }
    }

    load_data_info(accountSerialized : SerializedDataInfo)
    {
        this.raw_account_data.clear();
        Object.keys(accountSerialized).map((account_name) => {
            let account_data = accountSerialized[account_name];
            let category_filter = observable.map<string>();
            let category_override = observable.array<CategoryOverride>();
            let account_type : AccountType = 'Cash';

            if (account_data.category_filter)
            {
                Object.keys(account_data.category_filter).forEach((x) => {
                    category_filter.set(x, account_data.category_filter[x]);
                });
            }

            if (account_data.category_override)
            {
                account_data.category_override.forEach((x) => {
                    category_override.push(x);
                });
            }
            
            if (account_data.account_type)
            {
                account_type = account_data.account_type;
            }

            if (account_data.raw_data)
            {
                var raw_data_2 = account_data.raw_data.map((x) => {
                    return {
                        uploaded : new Date(x.uploaded),
                        transactions : x.transactions,
                        date_format : x.date_format
                     }
                });
                raw_data_2.sort((a,b) => {
                    let x = date_range(a);
                    let y = date_range(b);
                    if (x && y)
                    {
                        return x[0] < y[0] ? -1 : 1;
                    }
                    else
                    {
                        return 0;
                    }
                });
                this.raw_account_data.set(account_name,
                    {
                        uploaded_data : raw_data_2,
                        category_filter : category_filter,
                        category_override : category_override,
                        initial_balance : account_data.initial_balance ? account_data.initial_balance : 0,
                        account_type : account_type
                    });
            }
        });
    }

    constructor(accountSerialized : SerializedData | null)
    {
        if (accountSerialized)
        {
            this.load_data(accountSerialized);
        }
    }

    removeRawAccountData(account_name : string, i : number) {
        let x = this.raw_account_data.get(account_name);
        if (x) {
            if (i < x.uploaded_data.length)
            {
                x.uploaded_data.splice(i, 1);
            }
        }
    }

    addRawAccountData(account_name : string, date_format : DateFormat, transactions : QIFTransactionDetails[]) {
        let account = this.raw_account_data.get(account_name);
        if (account)
        {
            var x = this.raw_account_data.get(account_name);
            var uploaded_data = { uploaded : new Date(), date_format : date_format, transactions : [...transactions] };
            if (x) {
                x.uploaded_data.push(uploaded_data);
            } else { 
                this.raw_account_data.set(account_name,{
                    uploaded_data : [uploaded_data],
                    category_filter : observable.map<string>(),
                    category_override : observable([]),
                    initial_balance : 0,
                    account_type : 'Cash'
                });
            }
        }
        else
        {
            return false;
        }
    }

    addAccount(account : string) {
        if (this.raw_account_data.get(account))
        {

        }
        else
        {
            this.raw_account_data.set(account, {
                uploaded_data : [],
                category_filter : observable.map<string>(),
                category_override : observable([]),
                initial_balance : 0,
                account_type : 'Cash'
            });
        }
    }

    setAccountType(account_name : string, account_type : AccountType)
    {
        let account = this.raw_account_data.get(account_name);
        if (account)
        {
            account.account_type = account_type;
        }
    }

    removeAccount(account_name : string) {
        this.raw_account_data.delete(account_name);
    }

    @computed get serialized() {
        return serialize(this);
    }
}



function load_from_storage() {
    var account_info = localStorage.getItem('account_info');
    if (account_info)
    {
        return new AccountDataStore(JSON.parse(account_info) as SerializedData);
    }
    else
    {
        return new AccountDataStore(null);
    }
}
export const account_store = load_from_storage();

const local_storage_watcher = autorun(() => {
    var serialized = JSON.stringify(account_store.serialized);
    localStorage.setItem('account_info', serialized);
});