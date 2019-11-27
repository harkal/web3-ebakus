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

const clientConfig = {
  target: 'web',
  node: {
    fs: 'empty',
  },
  entry: {
    'web3-ebakus': './src/browser.js',
  },
  externals: [
    nodeExternals({
      whitelist: ['web3'],
    }),
  ],
  output: {
    filename: '[name].browser.js',
  },
  devServer: {
    contentBase: ['./example', './lib'],
  },
  optimization: getOptimization('web'),
}

const serverConfig = {
  target: 'node',
  entry: {
    'web3-ebakus': './src/index.js',
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
  ],
  optimization: getOptimization('node'),
}

module.exports = [
  merge(baseConfig, clientConfig),
  merge(baseConfig, serverConfig),
]
