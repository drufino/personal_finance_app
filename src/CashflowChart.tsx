import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observable, computed } from 'mobx';
import { observer } from 'mobx-react';
import * as AccountData from './AccountData';
import { account_store, SummaryView } from './AccountData';
import ReactDatePicker from 'react-datepicker';
import { ReactDatePickerProps } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import * as QIF from './QIF';
import * as moment from 'moment';
import { Chart } from './Chart';
import { Grid, Dropdown, Tab, Label, Form } from 'semantic-ui-react'

type Categorization = { [ category : string ] : number };

type CashflowProps = {
    all_transactions : AccountData.Transaction[],
    summary_view : SummaryView
};

@observer
export class CashflowCategory extends React.Component<CashflowProps, {}>
{
    render() {
        let all_transactions = this.props.all_transactions;

        let expenses : Categorization = {};
        let income : Categorization = {};

        let update = (categorization : Categorization, transaction : AccountData.Transaction) => {
            let category = transaction.category ? transaction.category : 'Unknown';

            if (categorization[category])
            {
                categorization[category] += transaction.amount;
            }
            else
            {
                categorization[category] = transaction.amount;
            }
        }

        for (var transaction of all_transactions) {
            if (!transaction.category)
            {
                update(expenses, transaction);
                continue;
            }

            if (this.props.summary_view.excluded_categories.indexOf(transaction.category) > -1)
            {
                continue;
            }

            if (this.props.summary_view.income_categories.indexOf(transaction.category) > -1)
            {
                update(income, transaction);
            }
            else if (transaction.category == 'Transfer')
            {
                // do nothing
            }
            else
            {
                update(expenses, transaction);
            }
        }

        let categories = Object.keys(expenses);
        let values = categories.map((x) => -expenses[x]);
        let total = values.reduce((x,y) => x+y, 0.0);

        var data = [{
            values: values,
            showlegend : false,
            labels: Object.keys(expenses),
            type: 'pie',
            text : values.map((v,i) => (v/total>0.02) ? (`${categories[i]} <br> ${(v/total*100.0).toFixed(2)}%`) : ''),
            textinfo: 'text',
            hoverinfo:'label+value+percent'
        }];
        
        let layout = {
            margin      : { l : 30, r : 30, t : 0, b : 60 },
            width       : 1000,
            height      : '100vh',
            tickangle   : -90,
            autosize    : true
        };
    
        return <Chart data={data} layout={layout} />
    }
}

@observer
export class CashflowSummary extends React.Component<CashflowProps, {}>
{
    render() {
        let all_transactions = this.props.all_transactions;

        let per_month : { year : number, month : number, income : number, expenses : number }[] = [];

        for (var transaction of all_transactions) {
            if (transaction.category && this.props.summary_view.excluded_categories.indexOf(transaction.category) > -1)
            {
                continue;
            }
    
            let date = transaction.date;
            var index = per_month.findIndex((x) => { return x.year == date.getFullYear() && x.month == date.getMonth() } );
            if (index == -1)
            {
                per_month.push({ year : date.getFullYear(), month : date.getMonth(), income : 0., expenses : 0.});
                index = per_month.length - 1;
            }

            if (transaction.category && this.props.summary_view.income_categories.indexOf(transaction.category) > -1)
            {
                per_month[index].income += transaction.amount;
            }
            else
            {
                per_month[index].expenses -= transaction.amount;
            }
        }

        per_month.sort((x,y) => ((x.year == y.year) ? x.month < y.month : x.year < y.year) ? -1 : 1);

        let x = 
        per_month.map((x) => `${QIF.month_names_short[x.month]}`);

        let expenses  = per_month.map((x) => x.expenses);
        let income    = per_month.map((x) => x.income);

        let income_graph = {
            x : x,
            y : income,
            name : 'Income',
            type : 'bar'
        };

        let expense_graph = {
            x : x,
            y : expenses,
            name : 'Expenses',
            type : 'bar'
        };

        let total_income = income.reduce((x,y) => (x+y), 0.);
        let total_expenses = expenses.reduce((x,y) => (x+y), 0.0);

        let data = [income_graph, expense_graph];
        let layout = {
            title: `Net Income=${(total_income - total_expenses).toFixed(0)}`,
            margin      : { l : 30 },
            width       : 1000,
            height      : 500,
            tickangle   : -90,
            autosize    : true
        };

        return <Chart data={data} layout={layout} />;
    }
}

@observer
export class CashflowChart extends React.Component<CashflowProps,{}>
{
    render() {
        let all_transactions = this.props.all_transactions;

        let data = [...all_transactions];
        
        data.sort((a,b) => (a.date < b.date) ? -1 : 1);

        let dates : Date[] = [];
        let x : number[] = [];
        let y : number[] = [];

        let epoch = (x : Date) => { return Math.floor(x.valueOf()/8.64e7) };

        let initial_balance = account_store.accounts.map((account) => {
            if (account) return account.initial_balance;
            else return 0.;
        }).reduce((x,y) => (x+y),0.0);

        for (var i = 0; i < data.length; ++i)
        {
            if (i == 0)
            {
                y.push(initial_balance + data[i].amount);
                x.push(epoch(data[i].date));
                dates.push(data[i].date);
            }
            else if (x.length > 0 && epoch(data[i].date) == x[x.length - 1] && (i+1) != data.length)
            {
                y[y.length-1] += data[i].amount;
            }
            else
            {
                dates.push(data[i].date);
                x.push(epoch(data[i].date));
                y.push(y[y.length - 1] + data[i].amount);
            }
        }

        let tick_x : number[] = [];
        let tick_dates : Date[] = [];

        for (var i = 0; i < x.length; ++i)
        {
            if ((i == 0) || (x[i] >= tick_x[tick_x.length - 1] + 7.0))
            {
                tick_x.push(x[i])
                tick_dates.push(dates[i]);
            }
        }

        let chart_data = {
            x   : x,
            y   : y,
            type: 'scatter'
        };
    
        let total = y[y.length - 1] - y[0];
        let days = x[x.length - 1] - x[0];

        let layout = {
            title: `Net ${total.toFixed(0)} = ${(total/days*365.0/12).toFixed(0)} pm `,
            margin      : { l : 30 },
            width       : 1000,
            height      : '100vh',
            tickangle   : -90,
            autosize    : true,
            xaxis       : {
                tickmode : 'array',
                tickvals : tick_x,
                ticktext : tick_dates.map((d) => `${d.getDate()}-${QIF.month_names_short[d.getMonth()]}`)
            }
        };

        return <Chart data={[chart_data]} layout={layout} />;
    }
}

@observer
export class Cashflow extends React.Component<{}, {}>
{
    @observable start_date : moment.Moment | null;

    constructor()
    {
        super({});
        this.start_date = null;
    }

    @computed get all_transactions()
    {
        let all_transactions = account_store.get_all_transactions({cash_only : this.summary_view.cash_only});

        if (this.start_date)
        {
            let start_date = this.start_date;
            all_transactions = all_transactions.filter((v) => (v.date.valueOf() >= start_date.toDate().valueOf()));
        }
        return all_transactions;
    }

    @computed get summary_view()
    {
        return {...account_store.summary_view};
    }

    wrap(component : React.ComponentClass<CashflowProps>, start_date : moment.Moment, cashflow_props : CashflowProps, update_field : <K extends keyof SummaryView>(_ : SummaryView[K], field : K) => void) : JSX.Element
    {
        let expand_option = (x : string) => ({ key : x, text : x, value : x});
    
        let options = account_store.all_categories.map(expand_option);
        let income_options = account_store.income_categories[1].map(expand_option);

        let summary_view = cashflow_props.summary_view;
        let excluded_categories = summary_view.excluded_categories;
        let income_categories = summary_view.income_categories;
        let cash_only = summary_view.cash_only;

        let start_date_props : ReactDatePickerProps = {
            selected : start_date,
            dateFormat : 'YYYY-MM-DD',
            onChange : (x,v) => {
                if (x)
                    this.start_date = x;
            }
        };

        let to_array = (x : any) : string[] => {
            if (Array.isArray(x))
            {
                let categories : string[] = [];
                x.map((y) => {
                    if (typeof y == 'string')
                    {
                        categories.push(y);
                    }
                });
                return categories;
            }
            else
            {
                return [];
            }
        }
        return (
            <Tab.Pane>
                <Grid columns={1}>
                    <Grid.Row style={{paddingBottom:'0px'}}>
                    <Grid.Column stretched>
                        <Form style={{margin:'0px'}} >
                            <Form.Group inline>
                                <label>Cashflow Type</label>
                                <Form.Dropdown
                                    selection
                                    value={cash_only ? 'Cash' : 'Credit'}
                                    options={[{text : 'Cash', value : 'Cash'}, {text : 'Credit', value : 'Credit' }]}
                                    onChange={(e,data) => { update_field((data.value === 'Cash'), 'cash_only'); }}
                                />
                                <label>Exclude Categories</label>
                                <Form.Dropdown
                                options={options}
                                multiple
                                selection
                                value={excluded_categories}
                                placeholder='Exclude Categories'
                                onChange={(e,data) => {update_field(to_array(data.value), 'excluded_categories');}}
                                />
                                <label>Income Categories</label>
                                <Form.Dropdown
                                options={income_options}
                                multiple
                                selection
                                value={income_categories}
                                placeholder='Income Categories'
                                onChange={(e,data) => {update_field(to_array(data.value), 'income_categories')}}
                                />
                            </Form.Group>
                        </Form>
                    </Grid.Column>
                    </Grid.Row>
                    <Grid.Row style={{padding:'0px'}}>
                        <Grid.Column stretched>
                        <Form style={{margin:'0px'}} >
                            <Form.Group inline>
                                <label>Start Date</label>
                                <Form.Field
                                    control={ReactDatePicker}
                                    {...start_date_props}
                                >
                                </Form.Field>
                            </Form.Group>
                        </Form>
                        </Grid.Column>
                    </Grid.Row>
                    <Grid.Row>
                        <Grid.Column>  
                        {React.createElement(component, cashflow_props)}
                        </Grid.Column>
                    </Grid.Row>
                </Grid>
            </Tab.Pane>);
    }
    public render() {
        let update_field = <K extends keyof SummaryView>(x : SummaryView[K], field : K) => {
            let update : Partial<SummaryView> = {};
            update[field] = x;
            account_store.update_summary_view(update);
        }

        let summary_view = this.summary_view;

        let cashflow_props = { all_transactions : this.all_transactions, summary_view : summary_view };

        let start_date = this.start_date ? this.start_date : moment(this.all_transactions[0].date);

        let panes_ = [
            {menuItem : 'Chart', component: () => CashflowChart as React.ComponentClass<CashflowProps>},
            {menuItem : 'Summary', component : () => CashflowSummary as React.ComponentClass<CashflowProps>},
            {menuItem : 'Categories', component : () => CashflowCategory as React.ComponentClass<CashflowProps>}
        ];

        let panes = panes_.map((pane) => (
            {
                menuItem : pane.menuItem,
                render : () => (this.wrap(pane.component(), start_date, cashflow_props, update_field))
            }
        ));

        return (
        <div style={{marginLeft:'30px'}} className="container">
            <Tab defaultActiveIndex={1} style={{width:'100%'}} menu={{ secondary: true, pointing: true }} panes={panes}>
            </Tab>
        </div>);
    }
}
