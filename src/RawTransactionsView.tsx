import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observable, computed } from 'mobx';
import { observer } from 'mobx-react';
import { account_store } from './AccountData';
import * as AccountData from './AccountData';
import { Table, Icon, Dropdown } from 'semantic-ui-react';
import * as QIF from './QIF';
import { QIFTransactionsTable } from './QIFTransactionsTable';

let TH = Table.HeaderCell;
let TD = Table.Cell;

@observer
export class RawTransactionsView extends React.Component<{account_name:string},{}>
{
    @observable active_transactions : number | null = 0;

    componentWillReceiveProps(newProps : { account_name : string})
    {
        if (newProps.account_name != this.props.account_name)
            this.active_transactions = 0;
    }

    deleteRawTransactions(i : number) {
        return () => {
            if (confirm('Are you sure you want to delete this raw data?'))
            {
                account_store.removeRawAccountData(this.props.account_name, i);
                if (this.active_transactions != null && this.active_transactions >= i)
                {
                    if (this.active_transactions == 0)
                    {
                        this.active_transactions = null;
                    }
                    else
                    {
                        this.active_transactions--;
                    }
                }
            }
        }
    }
    options = QIF.DateFormats.map((x:string) => {return {'key':x,'text':x,'value':x}});

    @computed get sorted_data()
    {
        let data = account_store.getRawData(this.props.account_name);
        if (data)
        {
            if (data.uploaded_data.length == 0)
                return [];
            else
                return [...data.uploaded_data].reverse();
        }
        else
        {
            return null;
        }
    }

    public render()
    {
        const data = this.sorted_data;

        if (data)
        {
            if (data.length == 0)
            {
                return <div>No data has been uploaded</div>;
            }

            const sorted_data = data;

            if ((this.active_transactions != null) && this.active_transactions >= sorted_data.length)
            {
                alert('Out of bounds error');
                return null;
            }

            const this_data = ((this.active_transactions != null)) ? sorted_data[this.active_transactions] : null;

            let transactions = null;

            if (this_data)
            {
                let date_format = this_data.date_format;
                transactions=(
                <div /*style={{maxWidth:'600px'}}*/>
                    <QIFTransactionsTable data={this_data.transactions} date_format={date_format} /> 
                </div>
                );
            }



            return (
                <div>
                <table className="ui table collapsing small">
                <thead><tr>
                    <th></th><th>Uploaded</th><th>File Date Format</th><th>First Date</th><th>Last Date</th>
                </tr>
                </thead>
                <tbody>
                {
                    sorted_data.map((x,i) => {
                        let this_date_range = AccountData.date_range(x);
                        let start_date = '';
                        let end_date = '';
                        if (this_date_range)
                        {
                            if (this_date_range[0] instanceof Date)
                            {
                                start_date = (this_date_range[0] as Date).toDateString();
                            }
                            else
                            {
                                start_date = this_date_range[0] as string;
                            }
                            if (this_date_range[1] instanceof Date)
                            {
                                end_date = (this_date_range[1] as Date).toDateString();
                            }
                            else
                            {
                                end_date = this_date_range[1] as string;
                            }
                        }
                        let n = sorted_data.length;
    
                        return <Table.Row onClick={() => {this.active_transactions = i;}} key={i}  active={i==this.active_transactions}>
                            <td><Icon name='trash' size='large' onClick={this.deleteRawTransactions(n-i-1)}></Icon></td>
                            <td >{x.uploaded.toDateString()}</td>
                            <td><Dropdown options={this.options} floating onChange={(e,v) => {x.date_format = v.value as QIF.DateFormat}} value={x.date_format}/>
                            </td>
                            <td>{start_date}</td>
                            <td>{end_date}</td>
                            </Table.Row>;
                    })
                }
                </tbody>
                </table>
                {transactions}
                </div>
            );
        }
        return null;
    }
};