///<reference types="webpack-env" />
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Menu, Modal, Dropdown, Tab, Button, Input, Grid, Divider, Table, Label, Icon, Header } from 'semantic-ui-react'
import { observable, computed } from 'mobx';
import * as mobx from 'mobx';
import { observer } from 'mobx-react';
import { account_store, AccountType } from './AccountData';
import { SerializedData } from './AccountSerializedData';
import * as AccountData from './AccountData';
import * as QIF from './QIF';
import { QIFTransactionDetails } from './QIF';
import { QIFTransactionsTable } from './QIFTransactionsTable';
import { AccountUpload, ImportData } from './AccountUpload';
import { Cashflow } from './CashflowChart';
import { RawTransactionsView } from './RawTransactionsView';

let TH = Table.HeaderCell;
let TD = Table.Cell;

@observer
class CreateAccount extends React.Component<{open:boolean, onClose:(_:boolean,account_name:string) => void},{}>
{
    @observable account_name : string = '';
    ref : any = null;

    componentDidMount() {
        if (this.ref)
            this.ref.focus();
    }

    render() {
        let props = this.props;

        return (
        <Modal size='small' open={props.open} onClose={(ev,data) => {this.props.onClose(false, '')}}>
            <Modal.Header>
                Create Account
            </Modal.Header>
            <Modal.Content>
                Enter account here <Input ref={(ref) => {this.ref = ref}} value={this.account_name} onChange={(ev,data) => {this.account_name = data.value;}} ></Input>
            </Modal.Content>
            <Modal.Actions>
                <Button onClick={() => props.onClose(false, '')} negative>Cancel</Button>
                <Button onClick={() => props.onClose(true, this.account_name)} positive icon='checkmark' labelPosition='right' content='Ok' />
            </Modal.Actions>
        </Modal>
        );
    }
};

type TransactionsViewProps =
{
    account_name : string;
    transactions : AccountData.Transactions;
    transfers : [string, AccountData.Transaction, string, AccountData.Transaction][];
    categories : string[];
};

@observer
class TransactionsView extends React.Component<TransactionsViewProps,{}>
{
    @observable open : boolean[] = [];

    constructor(props : TransactionsViewProps)
    {
        super(props);
        this.open = new Array(props.transactions.length).fill(false);
    }

    componentWillReceiveProps(new_props : TransactionsViewProps)
    {
        this.open = new Array(new_props.transactions.length).fill(false);
    }

    public render()
    {
        let transactions = this.props.transactions;

        let transfers = this.props.transfers;

        let cmp = (x:AccountData.Transaction,y:AccountData.Transaction) => {
            return x.amount == y.amount && x.who == y.who && x.date.toDateString() == y.date.toDateString() && x.category == y.category
        }

        let options = this.props.categories.map((x) => ({ text : x, value : x}));

        options = [{text : 'Uncategorized', value : ''}, ...options];

        let transaction_matched = (transaction : AccountData.Transaction) => {
            if (transaction.category != 'Transfer' && transaction.category != 'Credit Card Payment')
                return false;
            let res = transfers.find((x) => cmp(x[1],transaction) || cmp(x[3],transaction));
            if (res) return true;
            else return false;
        };

        return(
        <table className="ui table">
            <thead>
                <tr>
                    <th>Date</th><th>Description</th><th>Category</th><th>Amount</th>
                </tr>
            </thead>
            <tbody>
            {
                transactions.map((x,i) => {
                    let bPositive=false;
                    let bNegative=false;
                    if (x.category == 'Transfer' || x.category == 'Credit Card Payment')
                    {
                        if (transaction_matched(x))
                        {
                            bPositive = true;
                        }
                        else
                        {
                            bNegative = true;
                        }
                    }

                    let category_value = x.category ? x.category : '';

                    let open = this.open[i];

                    let category_row =<td><Dropdown fluid scrolling pointing
                        search
                        text={category_value}
                        value={category_value}
                        allowAdditions={true}
                        placeholder={'Uncategorized'}
                        selection
                        open={open}
                        onClick={() => {
                            this.open[i] = !this.open[i];
                        }}

                        onChange={(e,v) => {
                            if (typeof v.value == 'string')
                                account_store.categorize(this.props.account_name,x,v.value)
                            this.open[i] = false;
                        }}

                        onBlur={() => {
                            this.open[i] = false;
                        }}
                        options={open ? options : []}/></td>;

                    return (
                    <tr key={i} className={(bPositive ? "positive" : "") + (bNegative ? " negative" : "")}>
                        <td>{x.date.toDateString()}</td>
                        <td>{x.who}</td>
                        {category_row}
                        <td>{x.amount}</td>
                    </tr>);
                })
            }
            </tbody>
        </table>);
    }
};

@observer
class CategoryView extends React.Component<{account_name : string}, {}>
{
    @observable account_name = '';
    @observable current_search_string : string = '';
    @observable current_category : string = '';

    constructor(props : {account_name : string})
    {
        super(props);
        this.account_name = props.account_name;
    }

    componentWillReceiveProps(newProps : { account_name : string})
    {
        this.account_name = newProps.account_name;
    }

    @computed get categories()
    {
        let account = account_store.getRawData(this.account_name);
        if (account) return account.category_filter;
        return null;
    }

    onKeyPress = (e : any) => {
        let code = e.keyCode ? e.keyCode : e.which;
        if (code == 13 && this.current_search_string != '' && this.current_category != '')
        {
            if (this.categories)
                this.categories.set(this.current_search_string,this.current_category);
        }
    }

    onChange2 = (e:any) => {
        this.current_category = e.currentTarget.value
    }

    second_input = { onChange : this.onChange2, onKeyPress : this.onKeyPress };
    table_style = {width : '50%'};

    render() {
        let category_filter = this.categories;
        if (category_filter)
        {
            let this_category_filter : mobx.ObservableMap<string> = category_filter;

            return (
                <table className="ui table collapsing" style={this.table_style}>
                    <thead><tr><th></th><th>Search String</th><th>Category</th></tr></thead>
                    <tbody>
                        {
                            this_category_filter.entries().map((x,i) => {
                                return <tr key={i}>
                                    <td><Icon onClick={() => {this_category_filter.delete(x[0])} } name='remove'/></td>
                                    <td>{x[0]}</td>
                                    <td>{x[1]}</td>
                                    </tr>
                            })
                        }
                    </tbody>
                    <tfoot>
                        <tr>
                            <td/>
                            <td>
                            <Input
                            onChange={(e)=>{this.current_search_string = e.currentTarget.value}}
                            /></td>
                            <td><Input input={this.second_input}/>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            );
        }
        return null;
    }
};

interface AppContentProps {account_name:string, delete_account : () => void, upload : () => void};

@observer
class AppContent extends React.Component<AppContentProps,{}>
{
    @observable account_name = '';
    @observable current_balance : string | null = '';

    constructor(props : AppContentProps)
    {
        super(props);
        this.current_balance = null;
        this.account_name = this.props.account_name;
    }

    componentWillReceiveProps(newProps : AppContentProps)
    {
        this.current_balance = null;
        this.account_name = newProps.account_name;
    }

    @computed get initial_balance() {
        let x = account_store.findAccount(this.account_name);
        if (x)
        {
            return x.initial_balance;
        }
        else
        {
            return 0.0;
        }
    }
    @computed get balance() {
        return account_store.balance(this.data) + this.initial_balance;
    }

    @computed get data() {
        return account_store.get_transactions(this.account_name);
    }

    trySetBalance()
    {
        if (!this.current_balance)
            return;

        let delta = parseFloat(this.current_balance);
        if (isNaN(delta))
        {
            this.current_balance = null;
        }
        else
        {
            delta = delta - this.balance;
            let x = account_store.findAccount(this.account_name);
            if (x) { account_store.setInitialBalance(this.account_name, x.initial_balance + delta); }
            this.current_balance = null;
        }
    }

    render() {
        let account_name = this.account_name;
        if (account_name == '')
            return null;

        let data =  this.data;

        let transfers = account_store.transfers;

        let account_info = account_store.get_account_info(account_name);

        let categories = account_store.all_categories;

        let panes = [
            {menuItem : 'Transactions', render: () => { return <TransactionsView account_name={account_name} categories={categories} transactions={data} transfers={transfers}/>;}},
            {menuItem : 'Raw data', render : () => { return <RawTransactionsView account_name={account_name}/>;}},
            {menuItem : 'Categories', render : () => { return <CategoryView account_name={account_name}/>;}}
        ];

        let panes_ = () => {
            return panes.map((x,i) =>{
                return {
                    menuItem : x.menuItem,
                    pane : { 
                        key : i.toString(),
                        content : x.render()
                    }
                };
            });
        }

        let current_balance = this.current_balance;
        if (current_balance == null)
            current_balance = this.balance.toFixed(2);
        
        let account_type = account_info ? account_info.account_type : '';

        let inputprops = {
            onBlur:(e:any) => {this.trySetBalance(); e.stopPropagation()},
            onChange:(e:any) => {this.current_balance = (e.target.value as string);},
            onKeyPress:(e:any) => {
                let code = e.keyCode ? e.keyCode : e.which;
                this.current_balance = (e.target.value as string);
                if (code == 13)
                {
                    this.trySetBalance();
                }
            }
        };
        var content =(
        <div style={{height:'100%', paddingLeft:'30px', paddingBottom:'40px', paddingTop:'20px', paddingRight:'30px'}}>  
        <Grid>
        <Grid.Row columns={1}>
        <Grid.Column>
        <Header as='h2' block>{account_name}</Header>
        </Grid.Column>
        </Grid.Row>
        <Grid.Row columns={5}>
        <Grid.Column key={0}>
        <Icon size='large' name='trash' onClick={() => this.props.delete_account()}/>
        <Icon size='large' name='upload' onClick={this.props.upload}/>
        </Grid.Column>
        <Grid.Column key={1} floated='left'>
            <Input label='Current Balance' value={current_balance} error={parseFloat(current_balance) != parseFloat(this.balance.toFixed(2))}
                input={inputprops}
            />
        </Grid.Column>
        <Grid.Column key={2}  floated='left'>
            <Label size='large'>Account Type</Label>
            <Dropdown
                        floating
                        selection
                        labeled
                        value={account_type}
                        options={[{text : 'Cash', value : 'Cash'}, {text : 'Credit', value : 'Credit' }]}
                        onChange={(e,data) => {
                            account_store.setAccountType(account_name, data.value as AccountType);
                        }}
            />
        </Grid.Column>
        </Grid.Row>
        <Grid.Row columns={1}>
        <Grid.Column stretched>
        <Tab renderActiveOnly={false} style={{width:'100%'}} menu={{ secondary: true, pointing: true }} panes={panes_()}>
        </Tab>
        </Grid.Column>
        </Grid.Row>
        </Grid>

        </div>
        );

        return content;
    }
}

@observer
export default class App extends React.Component<{},{}>
{
    @observable content_type : 'None'|'Cashflow'|'Account' = 'None';
    @observable see_accounts : boolean = true;
    @observable create_modal : boolean = false;
    @observable upload_modal : boolean = false;
    @observable import_modal : boolean = false;
    @observable active_account : string = '';

    constructor(props : {})
    {
        super(props);
        this.create_modal = false;
        this.upload_modal = false;
        this.import_modal = false;
        this.content_type = 'None';
    }
    onUploadData = (success : boolean, transactions : QIF.QIFTransactionDetails[] | null, date_format : QIF.DateFormat) => {
        this.upload_modal = false;

        if (success)
        {
            if (transactions)
            {
                account_store.addRawAccountData(
                    this.active_account,
                    date_format,
                    transactions
                );
            }
            else
            {

            }
        }
    }

    onImportData = (data : string) => {
        this.import_modal = false;
        if (data != '')
        {
            let parsed_data = JSON.parse(data) as SerializedData;
            account_store.load_data(parsed_data);
        }
    }

    removeAccount = () => {
        account_store.removeAccount(this.active_account);
        this.active_account = '';
    }

    onCreateAccountClose = (success : boolean, account_name : string) => {
        this.create_modal = false;
        if (success && account_name != '')
        {
            account_store.addAccount(account_name);
        }
    }

    onUpload = () => {
        this.import_modal = true;
    }

    onDownload = () => {
        let save = function(filename : string, data : any) {
            var blob = new Blob([data], {type: 'text/json'});
            if(window.navigator.msSaveOrOpenBlob) {
                window.navigator.msSaveBlob(blob, filename);
            }
            else{
                var elem = window.document.createElement('a');
                elem.href = window.URL.createObjectURL(blob);
                elem.download = filename;        
                document.body.appendChild(elem);
                elem.click();        
                document.body.removeChild(elem);
            }
        };
        save('account_data.json', JSON.stringify(account_store.serialized,null,2));
    }

    render()
    {
        var content = null;

        if (this.content_type == 'Cashflow')
        {
            content = <Cashflow/>
        }
        else if (this.content_type == 'Account')
        {
            content = <AppContent account_name={this.active_account} delete_account={this.removeAccount} upload={() => {this.upload_modal = true}}/>;
        }
        else {
            content = null;
        }

        if (content != null)
        {
            content = <div style={{overflowY : 'auto', overflowX : 'hidden', marginLeft: '210px'}}>{content}</div>
        }
        return (
            <div>

                <Menu vertical fixed='left' style={{paddingTop:'50px'}}>
                    <Menu.Item key={0} header onClick={() => { this.see_accounts = !this.see_accounts}}>
                        Accounts {this.see_accounts ? (<Icon  name='caret down'/>) : <Icon  name='caret left'/>}
                    </Menu.Item>
                    {(this.see_accounts) ? (
                        account_store.account_names.map((account,i) => {
                            return <Menu.Item key={i+1} position='right' onClick={() => {this.active_account = account;this.content_type='Account';}}><span style={{paddingLeft:'25px'}}>{account}</span></Menu.Item>
                        })
                        ) : null
                    }
                    {this.see_accounts ? <Menu.Item onClick={()=>{this.create_modal=true}}><span style={{paddingLeft:'25px'}}>Create Account...</span></Menu.Item> : null }
                    <Menu.Item onClick={() => {this.content_type='Cashflow'}}>Cashflow Report</Menu.Item>
                    <Menu.Item onClick={this.onDownload}>Export Data</Menu.Item>
                    <Menu.Item onClick={this.onUpload}>Import Data</Menu.Item>
                </Menu>
                {content}
                <CreateAccount open={this.create_modal} onClose={this.onCreateAccountClose}/>
                <AccountUpload account_name={this.active_account} open={this.upload_modal} onClose={this.onUploadData}/>
                <ImportData open={this.import_modal} onClose={this.onImportData}/>
            </div>
        );
    }
}

ReactDOM.render(
    <App/>,
    document.getElementById('app')
);

//if (module.hot) module.hot.accept()