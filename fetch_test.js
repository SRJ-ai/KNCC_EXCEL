fetch('https://kncc-excel.vercel.app').then(r=>r.text()).then(html=>{
  const m=html.match(/src="(\/assets\/index-.*?\.js)"/);
  if(m){
    fetch('https://kncc-excel.vercel.app'+m[1]).then(r=>r.text()).then(js=>{
      console.log('Real count:', (js.match(/wjpmruxpwhcbmzaurcbq\.supabase\.co/g)||[]).length);
      console.log('Placeholder count:', (js.match(/placeholder\.supabase\.co/g)||[]).length);
    });
  } else {
    console.log("No Vite JS found on live site.");
  }
}).catch(console.error);
