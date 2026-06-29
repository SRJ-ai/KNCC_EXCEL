fetch('https://kncc-excel-lfk6z0mfb-srj-ais-projects.vercel.app').then(r=>r.text()).then(html=>{
  const m=html.match(/src="(\/assets\/index-.*?\.js)"/);
  if(m){
    fetch('https://kncc-excel-lfk6z0mfb-srj-ais-projects.vercel.app'+m[1]).then(r=>r.text()).then(js=>{
      console.log('Supabase Domain count:', (js.match(/supabase\.co/g)||[]).length);
      console.log('Placeholder count:', (js.match(/placeholder\.supabase\.co/g)||[]).length);
      console.log('Real count:', (js.match(/wjpmruxpwhcbmzaurcbq\.supabase\.co/g)||[]).length);
    });
  }
});
