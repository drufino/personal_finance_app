import * as React from 'react';
import * as ReactDOM from 'react-dom';

declare var Plotly : any;

export class Chart extends React.Component<{data : any[], layout : any}, {}>
{
    ref : any = null;

    constructor(props : any)
    {
        super(props);
    }

    onRef = (ref: any) => {
        this.ref = ref;
    }

    componentDidMount() {
        if (this.ref)
        {
            Plotly.newPlot( this.ref, this.props.data, {...this.props.layout});
        }
    }

    componentDidUpdate() {
        this.componentDidMount();
    }

    render()
    {
        return <div ref={this.onRef} style={{height:'100%'}}/>
    }
};