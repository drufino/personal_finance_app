var webpack = require("webpack");

module.exports = [{
    entry: [
        './src/index.tsx'
    ],
    name : 'client', 
    devtool : 'cheap-module-source-map',
    module: {
        loaders: [
        {
            test: /\.jsx?$/,
            exclude: /node_modules/,
            loader: 'babel-loader'
        },
        {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            loader: 'ts-loader'
        },
        {
            test: /\.css$/,
            loader: 'style-loader!css-loader'
        }

        ]
    },
    resolve: {
        extensions: ['*', '.js', '.jsx', '.ts', '.tsx']
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env':{
                'NODE_ENV': JSON.stringify('production') 
            }
        })
    ],
    output: {
        path: __dirname + '/dist/public',
        publicPath: '/',
        filename: 'bundle.js'
    },
    devServer : {
        contentBase : './public'
    }
}
]
