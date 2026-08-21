export function safeArray(value){
  if(Array.isArray(value))return value;
  if(value==null||value==='')return[];
  if(typeof value==='string'){try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[parsed]}catch{return value.split(/\n|,/).map(item=>item.trim()).filter(Boolean)}}
  return[value];
}
function safeObject(value,shape){
  let item=value;if(typeof item==='string'){try{item=JSON.parse(item)}catch{item={description:item}}}
  if(!item||typeof item!=='object'||Array.isArray(item))item={};
  return Object.fromEntries(Object.entries(shape).map(([key,fallback])=>[key,key==='technologies'?safeArray(item[key]).map(String).filter(Boolean):typeof item[key]==='string'?item[key]:fallback]));
}
export const normalizeExperience=value=>safeArray(value).map(item=>safeObject(item,{company:'',jobTitle:'',startDate:'',endDate:'',description:'',technologies:[]}));
export const normalizeProjects=value=>safeArray(value).map(item=>safeObject(item,{name:'',description:'',technologies:[]}));
export const normalizeEducation=value=>safeArray(value).map(item=>safeObject(item,{institution:'',degree:'',field:'',startDate:'',endDate:''}));
export const normalizeStrings=value=>[...new Map(safeArray(value).flatMap(item=>typeof item==='string'?item.split(/\n|,/):[]).map(item=>item.trim()).filter(Boolean).map(item=>[item.toLowerCase(),item])).values()];
export function descriptionParts(value){const text=String(value||'').trim();if(!text)return[];const explicit=text.split(/\n|(?:^|\s)[•▪◦]\s*|\s+-\s+/).map(item=>item.trim()).filter(Boolean);if(explicit.length>1)return explicit;const sentences=text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(item=>item.trim()).filter(Boolean);return sentences.length>1?sentences:[text]}
const groups={Languages:['javascript','typescript','python','java','c++','c#','sql','es6'],Frontend:['html','css','react','redux','tailwind','vite','responsive','angular','vue','next.js','figma'],Backend:['node','express','rest api','socket','jwt','bcrypt','rbac','django','spring'],Databases:['mysql','mongodb','postgres','sqlite','database design','amazon rds'],['Cloud & DevOps']:['aws','s3','rds','git','github','nginx','pm2','linux','ssh','ci/cd','docker','kubernetes','jenkins','terraform','lambda']};
export function categorizeSkills(value){const output=Object.fromEntries([...Object.keys(groups),'Other'].map(group=>[group,[]])),seen=new Set();for(const original of normalizeStrings(value)){const prefix=original.match(/^([^:]{2,24}):\s*(.+)$/),skill=(prefix?.[2]||original).trim(),key=skill.toLowerCase();if(!skill||seen.has(key))continue;seen.add(key);let group=prefix&&Object.keys(output).find(name=>name.toLowerCase().startsWith(prefix[1].trim().toLowerCase().split('&')[0]));if(!group)group=Object.entries(groups).find(([,terms])=>terms.some(term=>key.includes(term)))?.[0]||'Other';output[group].push(skill)}return output}
