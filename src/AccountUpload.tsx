import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observable, computed } from 'mobx';
import { observer } from 'mobx-react';
import * as QIF from './QIF';
import { account_store } from './AccountData';
import { QIFTransactionDetails } from './QIF';
import { Tab, Modal, Grid, Button, Dropdown, Divider, ModalProps } from 'semantic-ui-react'
import { QIFTransactionsTable } from './QIFTransactionsTable';

function read_file(files : FileList | null, callBack : (data: string) => void)
{
    var reader = new FileReader();
    if (files)
    {
        var reader = new FileReader();
        reader.onloadend = (ev : any) => {
            var contents = ev.target.result as string;
            callBack(contents);
        }
        reader.readAsText(files[0], 'ISO-8859-1');
    }
}

@observer
export class ImportData extends React.Component<{open : boolean, onClose : (data : string) => void},{}>
{
    @observable accessor data = '';

    onClose = (event: React.MouseEvent<HTMLElement>, data: ModalProps) => {
        this.props.onClose(this.data);
    }

    handleFileUpload = (ev : React.FormEvent<HTMLInputElement>) => {
        read_file(ev.currentTarget.files, (data : string) => {
            this.data = data;
        });
    }

    public render()
    {
        if (!this.props.open)
            return null;
        
        return <Modal open={this.props.open} closeOnDimmerClick={false} onClose={this.onClose}>
                <Modal.Header>
                    Import Data
                </Modal.Header>
                <Modal.Content>
                    <input onChange={this.handleFileUpload} type='file'/>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => this.props.onClose('')} negative>Cancel</Button>
                    <Button onClick={() => this.props.onClose(this.data)} positive icon='checkmark' labelPosition='right' content='Ok' />
                </Modal.Actions>
                </Modal>
    }
}

type AccountUploadState = {filename : string };

type AccountUploadProps = {
    account_name : string,
    open : boolean,
    onClose : (_: boolean, x: QIF.QIFTransactionDetails[] | null, date_format : QIF.DateFormat) => void
};

@observer
export class AccountUpload extends React.Component<AccountUploadProps, AccountUploadState>
{
    @observable accessor data = '';
    @observable accessor date_format : QIF.DateFormat = 'Unknown';
    transactions_table_ref : QIFTransactionsTable | null = null;
    @observable accessor flip : boolean = false;

    @computed get transactions() {
        if (!this.data || this.data == '')
            return null;
        else
        {
            let transactions = QIF.parse_csv(this.data);
            if (transactions) {
                transactions = (transactions as QIFTransactionDetails[]).map((details : QIFTransactionDetails) => { return {
                    date:details.date,
                    amount:this.flip ? -details.amount : details.amount,
                    who:details.who,
                    address:details.address,
                    number:details.number
                    }
                });
            }
            return transactions;
        }
    }

    valid_formats() {
        let transactions = this.transactions;

        if (QIF.is_valid(transactions) && transactions.length > 0)
        {
            let dates = transactions.map((x) => x.date);

            let filtered_formats =
            QIF.DateFormats.filter((format) => {
                var parsed_dates = dates.map((date) => QIF.normalize_date_string(date, format));
                let failed_dates = parsed_dates.filter((x) => (x.substr(0,6) == 'Invali')).length;
                return failed_dates == 0;
            });

            return filtered_formats;
        }
        else
        {
            return QIF.DateFormats;
        }

    }

    constructor(props : {account_name: string, open:boolean, onClose:(_:boolean) => void})
    {
        super(props);
        this.state = { filename : '' };
        this.data = '';
    }

    handleFileUpload = (e : React.FormEvent<HTMLInputElement>) => {
        read_file(e.currentTarget.files, (data : string) => {
            this.data = data;
            let valid_formats = this.valid_formats();
            this.date_format = valid_formats[valid_formats.length > 0 ? 1 : 0];
        });
    }
    
    onClose(success : boolean) {
        if (success)
        {
            let transactions = this.transactions;
            if (QIF.is_valid(transactions))
            {
                if (this.transactions_table_ref && this.transactions_table_ref.selected)
                {
                    let selected = this.transactions_table_ref.selected;
                    transactions = transactions.filter((x,i) => selected[i]);
                }
                this.props.onClose(success, transactions, this.date_format);
            }
            else
            {
                this.props.onClose(false, null, this.date_format);
            }
        }
        else
        {
            this.props.onClose(false, null, this.date_format);
        }

    }

    render() {
        var content = null;

        if (this.props.open == false)
        {
            return null;
        }

        let render_transactions = () => {
            let transactions = this.transactions;
            let is_new : boolean[] | undefined = undefined;

            if (QIF.is_valid(transactions))
            {
                is_new = [];
                for (var i = 0; i < transactions.length; ++i)
                {
                    if (account_store.is_duplicate(this.props.account_name, transactions[i]))
                    {
                        is_new.push(false);
                    }
                    else
                    {
                        is_new.push(true);
                    }
                }
            }

            return(
            <div style={{overflowY:'auto', overflowX:'hidden'}}>
            <Tab.Pane>
            {
                QIF.is_valid(transactions) ? 
                    <div style={{height:'300px'}}>
                        <QIFTransactionsTable ref={(ref) => {this.transactions_table_ref = ref}} selected={is_new} data={transactions} date_format={this.date_format}/>
                    </div> :
                    <div>Error parsing data: {transactions}</div>
            }
            </Tab.Pane>
            </div>);
        }

        let dropdown_options = this.valid_formats().map((x) => ({ text : x, value : x }));
        let dropdown_options2 = ['Unflipped','Flipped'].map((x) => ({ text : x, value : x }));

        return (
            <Modal open={this.props.open} closeOnEscape={false} closeOnDimmerClick={false} onClose={(ev,data) => { this.onClose(false); this.setState({filename:''}) }}>
                <Modal.Header>
                    Upload Data
                </Modal.Header>
                <Modal.Content>
                    <Grid columns={2}>
                    <Grid.Column>
                    <input onChange={this.handleFileUpload} type='file'/>
                    </Grid.Column>
                    <Grid.Column>
                    <Dropdown value={this.date_format} options={dropdown_options} onChange={(e,data) => {this.date_format = (data.value as QIF.DateFormat);}} />
                    </Grid.Column> 
                    <Grid.Column>
                    <Dropdown value={this.flip ? 'Flipped' : 'Unflipped'} options={dropdown_options2} onChange={(e,data) => {this.flip = ((data.value as string) == 'Flipped');}} />
                    </Grid.Column>  
                    </Grid>
                    <Divider/>
                    <Tab menu={{ secondary: true, pointing: true }}  defaultActiveIndex={1}
                        panes={[
                            { menuItem : 'Raw', render: () =>(
                                <Tab.Pane>
                                    <textarea onChange={(e) => {this.data = e.target.value}}
                                        style={{width : '100%', height : '300px'}} value={this.data}/>
                                </Tab.Pane>)
                            },
                            { menuItem : 'Transactions', render : render_transactions }
                        ]}
                    >
                    </Tab>
                </Modal.Content>
                <Modal.Actions>
                    <Button onClick={() => this.onClose(false)} negative>Cancel</Button>
                    <Button onClick={() => this.onClose(true)} positive icon='checkmark' labelPosition='right' content='Ok' />
                </Modal.Actions>
            </Modal>
        );
    }
};