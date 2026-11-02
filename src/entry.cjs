const {app}=require('electron');
const path=require('node:path');
const {main}=require('./main.cjs');
if(process.argv.includes('--smoke'))app.setPath('userData',path.resolve(__dirname,'../output/smoke-profile'));
app.whenReady().then(()=>main()).catch(error=>{console.error(error);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
