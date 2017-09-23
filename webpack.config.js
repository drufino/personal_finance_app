module.exports = {
    entry: [
        './src/index.tsx'
    ],
    devtool: 'source-map',
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
    output: {
        path: __dirname + '/public',
        publicPath: '/',
        filename: 'bundle.js'
    },
    devServer : {
        contentBase : './public',
        hot : true,
        proxy : {
            '/rpc' : {
                target : '127.0.0.1:8081'
            }
        }
    }
}
