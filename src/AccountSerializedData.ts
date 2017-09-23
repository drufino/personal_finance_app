import { QIFTransactionDetails, DateFormat } from './QIF';
import { AccountDataStore, SummaryView, AccountType } from './AccountData';

type CategoryOverrideSerialized = [ { date : string, amount : number, who : string}, string ];

export type AccountSerializedData = {
    raw_data? : {
       uploaded : string,
       transactions : QIFTransactionDetails[],
       date_format : DateFormat 
    }[],
    initial_balance? : number,
    category_filter : { [ search : string ] : string },
    category_override? : CategoryOverrideSerialized[ ],
    account_type? : AccountType
};

export type SerializedDataInfo =
{
    [ account_name : string ] : AccountSerializedData
};

export type SerializedData = 
{
    account_info? : SerializedDataInfo,
    summary_view? : Partial<SummaryView>
};

function serialize_info(store : AccountDataStore) : SerializedDataInfo
{
    var result : SerializedDataInfo = {};

    store.accounts.map((account_info) => {
        let raw_data = store.getRawData(account_info.name);



        let account_data : AccountSerializedData = { category_filter : {}, category_override : []  };
        if (raw_data)
        {
            account_data['raw_data'] = raw_data.uploaded_data.map((x) => {
                return {
                    uploaded : x.uploaded.toDateString(),
                    transactions : x.transactions,
                    date_format : x.date_format
                }
            });

            raw_data.category_filter.forEach((v,k) => {
                account_data.category_filter[k] = v;
            });
            
            raw_data.category_override.map((x) => {
                if (account_data.category_override)
                {
                    account_data.category_override.push(x);
                }
            });
        }
        account_data.initial_balance = account_info.initial_balance;
        account_data.account_type = account_info.account_type;
        result[account_info.name] = account_data;
    });
    return result;
}

export function serialize(store : AccountDataStore) : SerializedData
{
    let summary_view = store.summary_view;

    return { account_info : serialize_info(store), summary_view : summary_view };
}
