const webpack = require('webpack')

const config = {
  devtool: 'source-map',
  module: {
    rules: [
     {
        test: /\.(js)$/,
        loader: 'babel-loader'
     }
    ]
  },
  externals: {
    'stellar-sdk': 'StellarSdk'
  }
}

const library = Object.assign({}, config, {
  entry: './src/index.js',
  output: {
    path: __dirname + '/web',
    filename: 'index.js',
    chunkFilename: '[name].js',
    library: 'authenticator',
    libraryTarget: 'var'
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        vendors: false
      }
    }
  }
})

const worker = Object.assign({}, config, {
  entry: './src/worker.js',
  output: {
    path: __dirname + '/web',
    filename: 'worker.js',
  }
})

module.exports = [ library, worker ]
