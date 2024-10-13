module.exports = {
    entry: [
        './src/index.tsx'
    ],
    devtool: 'source-map',
    module: {
        rules: [
        {
            test: /\.tsx?$/,
            exclude: /node_modules/,
            loader: 'ts-loader'
        },
	{
	    test: /\.css$/,
            use:['style-loader','css-loader'],
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
        static : './public',
        hot : true
    }
}
