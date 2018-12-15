
require('@babel/register')({
  // ignore: [],
   "presets": [
     ["@babel/preset-env", {
       "targets": {
         "ie": "11"
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