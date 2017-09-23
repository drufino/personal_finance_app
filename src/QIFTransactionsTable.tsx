import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observable } from 'mobx';
import { observer } from 'mobx-react';
import { Table, Icon, Checkbox } from 'semantic-ui-react'
import * as QIF from './QIF';
import { QIFTransactionDetails } from './QIF';

let TH = Table.HeaderCell;
let TD = Table.Cell;

const center_align = { textAlign : 'center'};

type QIFTransactionTableProps = {
    data : QIFTransactionDetails[],
    date_format : QIF.DateFormat,
    selected? : boolean[]
};

@observer
export class QIFTransactionsTable extends React.Component<QIFTransactionTableProps>
{
    @observable selected : boolean[] | undefined = undefined;

    constructor(props:QIFTransactionTableProps)
    {
        super(props);
        this.selected = this.props.selected;
    }

    componentWillReceiveProps(nextProps : Readonly<QIFTransactionTableProps>)
    {
        if (nextProps != this.props)
        {
            this.selected = nextProps.selected;
        }
    }
    public render() {
        return (
            <table className="ui table compact small">
            <thead><tr key={0}>
                    {this.selected ? (<th></th>) : null}
                    <th style={center_align} className="collapsing">Date</th><th>Description</th><th style={center_align}>Amount</th>
            </tr></thead>
            <tbody>
            {
                this.props.data.map((x,i) => {
                    return <tr key={i+1}>
                        {
                            this.selected ?
                                (<td className="collapsing"><Checkbox onChange={() => {if (this.selected) this.selected[i] = !this.selected[i]}} checked={this.selected[i]}/></td>) :
                                null
                        }
                        <td className="collapsing">{QIF.normalize_date_string(x.date,this.props.date_format)}    </td>
                        <td className="single line">{x.who}</td>
                        <td style={center_align}>{x.amount}</td>
                        </tr>
                })
            }
            </tbody>
            </table>);
    }
}