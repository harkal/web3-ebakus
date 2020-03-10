import path from 'path'
import webpack from 'webpack'
import merge from 'webpack-merge'

import nodeExternals from 'webpack-node-externals'
import CleanWebpackPlugin from 'clean-webpack-plugin'
import TerserPlugin from 'terser-webpack-plugin'

import pkg from './package.json'

const now = new Date()

const NODE_ENV = process.env.NODE_ENV || 'development'
const IS_PRODUCTION = NODE_ENV === 'production'

const banner = `${pkg.description} v${pkg.version}

@author ${pkg.author}
@website ${pkg.homepage}

@copyright Ebakus ${now.getFullYear()}
@license ${pkg.license}`

const getOptimization = target => {
  if (!IS_PRODUCTION) {
    return {}
  }
  return {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        cache: true,
        parallel: true,
        sourceMap: !IS_PRODUCTION, // set to true if you want JS source maps
        terserOptions: {
          compress: {
            global_defs: {
              // false, means that it will be removed from Production build
              __DEV__: false,
              __DISABLED_FEATURE__: false,
            },
            warnings: false,
            sequences: true,
            conditionals: true,
            booleans: true,
            unused: true,
            if_return: true,
            join_vars: true,
            dead_code: true,
            drop_debugger: true,
            drop_console: target != 'node',
            passes: 2,
            pure_funcs: target != 'node' ? ['console', 'window.console'] : [],
          },
          mangle: true,
        },
      }),
    ],
  }
}

/*
 * Common configuration chunk to be used for both
 * client-side and server-side bundles
 */

const baseConfig = {
  mode: NODE_ENV,
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'lib'),
    libraryTarget: 'umd',
    libraryExport: 'default',
    library: {
      root: 'Web3Ebakus',
      amd: pkg.name,
      commonjs: pkg.name,
    },
    globalObject: 'this',
  },
  resolve: {
    modules: [path.resolve('./node_modules'), path.resolve('./src')],
    extensions: ['.json', '.js'],
  },
  stats: {
    colors: true,
  },
  devtool: IS_PRODUCTION ? '' : 'source-map',
  devServer: {
    contentBase: './lib',
  },
  plugins: [
    new CleanWebpackPlugin(['lib']),
    new webpack.BannerPlugin({ banner }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
      },
    ],
  },
}

const browserConfig = {
  target: 'web',
  node: {
    fs: 'empty',
  },
  entry: {
    'web3-ebakus': './src/browser.js',
  },
  output: {
    filename: '[name].browser.min.js',
  },
  devServer: {
    contentBase: ['./example', './lib'],
  },
  optimization: getOptimization('web'),
}

const clientConfig = {
  target: 'web',
  node: {
    fs: 'empty',
  },
  entry: {
    'web3-ebakus': './src/browser.js',
  },
  output: {
    filename: '[name].browser.esm.js',
  },
  externals: [
    nodeExternals({
      whitelist: ['web3'],
    }),
  ],
  devServer: {
    contentBase: ['./example', './lib'],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.TARGET': JSON.stringify('web'),
    }),
  ],
  optimization: getOptimization('web'),
}

const serverConfig = {
  target: 'node',
  entry: {
    'web3-ebakus': './src/index.js',
  },
  output: {
    filename: '[name].node.js',
  },
  externals: [
    nodeExternals({
      whitelist: ['web3', 'eth-lib'],
    }),
  ],
  plugins: [
    new webpack.ProvidePlugin({
      Worker: ['worker_threads', 'Worker'],
    }),
    new webpack.DefinePlugin({
      'process.env.TARGET': JSON.stringify('node'),
    }),
  ],
  optimization: getOptimization('node'),
}

const web3SubproviderClientConfig = {
  target: 'web',
  node: {
    fs: 'empty',
  },
  entry: {
    'web3-ebakus': './src/web3-subprovider.js',
  },
  output: {
    filename: '[name].web3-subprovider.esm.js',
  },
  externals: [
    nodeExternals({
      whitelist: ['web3'],
    }),
  ],
  plugins: [
    new webpack.DefinePlugin({
      'process.env.TARGET': JSON.stringify('web'),
    }),
  ],
  optimization: getOptimization('web'),
}

const web3SubproviderServerConfig = {
  target: 'node',
  entry: {
    'web3-ebakus': './src/web3-subprovider.js',
  },
  output: {
    filename: '[name].web3-subprovider.node.js',
  },
  externals: [
    nodeExternals({
      whitelist: ['web3', 'eth-lib'],
    }),
  ],
  plugins: [
    new webpack.ProvidePlugin({
      Worker: ['worker_threads', 'Worker'],
    }),
    new webpack.DefinePlugin({
      'process.env.TARGET': JSON.stringify('node'),
    }),
  ],
  optimization: getOptimization('node'),
}

module.exports = [
  merge(baseConfig, browserConfig),
  merge(baseConfig, clientConfig),
  merge(baseConfig, serverConfig),
  merge(baseConfig, web3SubproviderClientConfig),
  merge(baseConfig, web3SubproviderServerConfig),
]
