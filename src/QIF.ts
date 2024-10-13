export interface QIFTransactionDetails {
    date : string,
    amount : number,
    who : string,
    address : string[]
    number? : string
};

import { splitEasy } from "csv-split-easy";

export type DateFormat = 'Unknown' | 'MM-DD-YY' | 'DD-MM-YY' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
export var DateFormats : DateFormat[] = ['Unknown', 'MM-DD-YY', 'DD-MM-YY', 'MM/DD/YYYY', 'DD/MM/YYYY' ];
export var month_names_short=['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function to_string(date : Date, date_format : DateFormat) : string
{
    let month = date.getMonth()+1;
    let day = date.getDate();
    let year = date.getFullYear();

    let toString = (x : number) => {
        let s = x.toString();
        if (s.length < 2) s = "0" + s;
        return s;
    }
    if (date_format == 'MM-DD-YY')
    {
        return toString(month) + '-' + toString(day) + '-' + toString(year % 100);
    }
    else if (date_format == 'DD-MM-YY')
    {
        return toString(day) + '-' + toString(month) + '-' + toString(year % 100);
    }
    else if (date_format == 'DD/MM/YYYY')
    {
        return toString(day) + '/' + toString(month) + '/' + toString(year);
    }
    else if (date_format == 'MM/DD/YYYY')
    {
        return toString(month) + '/' + toString(day) + '/' + toString(year);
    }
    else
    {
        return date.toLocaleDateString();
    }
}

function normalize_date_helper(date : string, date_format : DateFormat) : Date | null
{
    if (date_format == 'Unknown')
    {
        return null;
    }
    else
    {
        var month : number;
        var day : number;
        var year : number;
        if (date_format == 'MM-DD-YY')
        {
            var dateString = date.split('-');
            if (dateString.length != 3)
            {
                return null;
            }
            month = parseInt(dateString[0]);
            day = parseInt(dateString[1]);
            year = parseInt(dateString[2]) + 2000;
        }
        else if (date_format == 'DD-MM-YY')
        {
            var dateString = date.split('-');
            if (dateString.length != 3)
            {
                return null;
            }
            month = parseInt(dateString[1]);
            day = parseInt(dateString[0]);
            year = parseInt(dateString[2]) + 2000;
        }
        else if (date_format == 'DD/MM/YYYY')
        {
            var dateString = date.split('/');
            if (dateString.length != 3)
            {
                return null;
            }
            month = parseInt(dateString[1]);
            day = parseInt(dateString[0]);
            year = parseInt(dateString[2]);
        }
        else if (date_format == 'MM/DD/YYYY')
        {
            var dateString = date.split('/');
            if (dateString.length != 3)
            {
                return null;
            }
            month = parseInt(dateString[0]);
            day = parseInt(dateString[1]);
            year = parseInt(dateString[2]);
        }
        else
        {
            return null;
        }

        if (!(month >= 1 && month <= 12))
        {
            return null;
        }

        if (!(day >= 1 && day <= 31))
        {
            return null;
        }

        return (new Date(year, month-1, day));
    }
}

export function normalize_date(date : string, date_format : DateFormat) : Date | null
{
    return normalize_date_helper(date, date_format);
}

export function normalize_date_string(date : string, date_format : DateFormat) : string
{
    if (date_format == 'Unknown')
    {
        return date;
    }
    else
    {
        let this_date = normalize_date_helper(date, date_format);
        if (this_date)
        {
            return this_date.getDate() + '-' + month_names_short[this_date.getMonth()]+'-'+this_date.getFullYear();
        }
        else
        {
            return 'Invalid date: ' + date;
        }
    }
}

export function is_valid(details : QIFTransactionDetails[] | string | null ): details is QIFTransactionDetails[]
{
    return ((details !== null) && !(typeof details == 'string'));
}

function is_currency(c : string)
{
    if (c[0] == '£')
    {
        return true;
    }
    else
    {
        return false;
    }
}

export function parse_csv(csv_text : string) : QIFTransactionDetails[] | string | null
{
    var lines = splitEasy(csv_text)
    var amount_idx = lines[0].findIndex((x : string) => x.toLowerCase() == 'amount');


    var total_details : QIFTransactionDetails[] = [];
    var transaction_number = 1;
    var line_number = 1;
    if (amount_idx == -1) { 
        amount_idx = 2;
        line_number = 0;
    }
    try {
        for (; line_number < lines.length; ++line_number)
        {
            var details : Partial<QIFTransactionDetails> = {address : []};
            let line = lines[line_number];
            details.date = line[0];
            details.who = line[1];
            let amount = line[amount_idx].replace(',','');
            details.amount = parseFloat(amount);
            total_details.push({
                date:details.date,
                amount:details.amount,
                who:details.who,
                address:[''],
                number:details.number
            });
        }
    } catch (e) {
        return `Error on line number ${line_number}: ${e}`;
    }

    return total_details;
}

export function parse(qif_text : string) : QIFTransactionDetails[] | string | null
{
    var lines = qif_text.split('\n');
    var line_number = 1;

    let get_line = () => {
        var line = lines.shift();
        if (!line) return null;
        line_number++;
        line = line.replace('\n','').replace('\r','');
        return line;
    }

    var line  = get_line();

    if (!line || line[0] != '!')
    {
        return null;
    }

    var total_details : QIFTransactionDetails[] = [];
    var transaction_number = 1;
    try {
        var details : Partial<QIFTransactionDetails> = {address : []};
        while (lines.length > 0)
        {
            line = get_line();
            if (!line)
                break;

            if (line[0] == 'D') {
                details.date = line.substr(1);
            } else if (line[0] == 'T') {
                let s_amount = line.substr(1);
                if (s_amount[0] == '-' && is_currency(s_amount[1]))
                {
                    s_amount = s_amount[0] + s_amount.substr(2);
                }
                else if (is_currency(s_amount[0]))
                {
                    s_amount = s_amount.substr(1);
                }
                s_amount = s_amount.replace(/,/g, '');
                details.amount = parseFloat(s_amount);
            } else if (line[0] == 'P') {
                details.who = line.substr(1);
            } else if (line[0] == 'A') {
                if (details.address)
                {
                    details.address = [...details.address, line.substr(1)];
                }
                else
                {
                    details.address = [line.substr(1)];
                }
            } else if (line[0] == 'N') {
                details.number = line.substr(1);
            } else if (line[0] == '^') { 
                if (details.date && details.amount && details.who && (details.address))
                {
                    total_details.push({
                        date:details.date,
                        amount:details.amount,
                        who:details.who,
                        address:details.address,
                        number:details.number
                    });
                    details = { address : [] };
                    transaction_number++;
                }
                else
                {
                    throw `Information missing for transaction ${transaction_number}`;
                }
            } else {
                throw `Unrecognised initial character ${line[0]}`;
            }
        }

        if (details.date || details.amount || details.who || (details.address && (details.address.length > 0)) || details.number)
        {
            throw `Partial information provided for transaction ${transaction_number}, check file is complete`;
        }
    } catch (e) {
        return `Error on line number ${line_number}: ${e}`;
    }

    return total_details;
}