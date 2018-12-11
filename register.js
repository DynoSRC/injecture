
require('@babel/register')({
  // ignore: [],
   "presets": [
     ["@babel/preset-env", {
       "targets": {
         "node": '8.10.0'
       }
     }],
     ["@babel/preset-typescript"]
   ],
   "extensions": [".js", ".ts"],
   "plugins": [
     "@babel/plugin-proposal-object-rest-spread",
     ["@babel/plugin-proposal-decorators", {
       legacy: true
     }],
     ["@babel/plugin-proposal-class-properties"],
   ]
 })