const fs=require('node:fs');
fs.mkdirSync('dist',{recursive:true});
for(const file of ['index.html','outdoors.html','credit-application.html','credit-application.js','Triple_C_Auto_Motorsports_Credit_Application_With_Logo.pdf']) fs.copyFileSync(file,`dist/${file}`);

fs.cpSync("assets", "dist/assets", {recursive:true});
