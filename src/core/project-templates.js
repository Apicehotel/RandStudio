export const PROJECT_TEMPLATES=Object.freeze({
  reel:{id:'reel',name:'Reel / TikTok',width:1080,height:1920,fps:30},
  story:{id:'story',name:'Story',width:1080,height:1920,fps:30},
  square:{id:'square',name:'Square Social',width:1080,height:1080,fps:30},
  youtube:{id:'youtube',name:'YouTube 1080p',width:1920,height:1080,fps:30},
  cinematic:{id:'cinematic',name:'Cinema 24p',width:1920,height:1080,fps:24},
  uhd:{id:'uhd',name:'4K UHD',width:3840,height:2160,fps:30},
});
export function applyProjectTemplate(project,id){const t=PROJECT_TEMPLATES[id];if(!t)throw new Error(`Template sconosciuto: ${id}`);return{...structuredClone(project),width:t.width,height:t.height,fps:t.fps,templateId:id,updatedAt:new Date().toISOString()}}
