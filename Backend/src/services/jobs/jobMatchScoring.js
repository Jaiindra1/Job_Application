const aliases=new Map([['js','javascript'],['javascript es6','javascript'],['reactjs','react'],['react.js','react'],['node','node.js'],['nodejs','node.js'],['express.js','express'],['ts','typescript'],['postgres','postgresql'],['mongo','mongodb'],['amazon web services','aws'],['html5','html'],['css3','css'],['rest api development','rest api']]);
const generic=new Set(['communication','teamwork','leadership','responsibility','hardworking','motivated','problem solving','management','collaboration']);
const technical=['javascript','typescript','react','node.js','express','python','java','c#','c++','sql','mysql','postgresql','mongodb','aws','azure','google cloud','html','css','redux','git','docker','kubernetes','angular','vue','next.js','rest api','graphql','spring','django','.net','figma','jest'];
const softwareTerms=['software','developer','engineer','engineering','frontend','front end','backend','back end','full stack','fullstack','web','react','node','javascript','programmer','application','devops','cloud','data'];
const unrelatedTerms=['sales','business development','marketing','human resources','hr executive','recruiter','account manager','relationship manager','territory manager'];
const managerTerms=['manager','lead','head','director'];
const SCORING_VERSION='deterministic-v2';

function normalize(value){return String(value||'').toLowerCase().replace(/\([^)]*\)/g,' ').replace(/^[^:]{1,30}:\s*/,'').replace(/[•]/g,' ').replace(/[^a-z0-9+#.]+/g,' ').trim()}
function canonical(value){const clean=normalize(value);return aliases.get(clean)||clean}
function unique(values){return[...new Map((values||[]).filter(Boolean).map(value=>[canonical(value),String(value).trim()])).entries()].map(([key,label])=>({key,label}))}
function contains(text,term){const clean=normalize(text),needle=canonical(term);return new RegExp(`(^|[^a-z0-9+#])${needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}([^a-z0-9+#]|$)`,'i').test(clean)}
function profileSkills(profile){return unique([...(profile.skills||[]),...(profile.technologies||[])]).filter(x=>!generic.has(x.key))}
function statedSkills(job,classified=[]){const text=`${job.title} ${(job.skills||[]).join(' ')} ${job.description||''}`;const candidates=unique([...(job.skills||[]),...classified,...technical.filter(skill=>contains(text,skill))]);return candidates.filter(x=>!generic.has(x.key)&&contains(text,x.key))}
function roleRelevance(job,profile){
 const jobTitle=normalize(job.title),jobText=`${job.title} ${job.description||''}`,roles=[profile.currentRole,...(profile.preferredRoles||[]),...(profile.jobTitles||[])].filter(Boolean);
 const userSoftware=roles.some(role=>softwareTerms.some(term=>contains(role,term))),jobSoftware=softwareTerms.some(term=>contains(jobTitle,term)),jobUnrelated=unrelatedTerms.some(term=>contains(jobTitle,term));
 if(userSoftware&&jobUnrelated)return .05;
 const userTokens=new Set(roles.flatMap(role=>normalize(role).split(' ')).filter(token=>token.length>2));const jobTokens=normalize(job.title).split(' ').filter(token=>token.length>2);const overlap=jobTokens.filter(token=>userTokens.has(token)).length/Math.max(jobTokens.length,1);
 let relevance=jobSoftware&&userSoftware?Math.max(.72,overlap):overlap;
 const technicalEvidence=technical.filter(skill=>contains(jobText,skill)).length;if(jobSoftware&&technicalEvidence)relevance+=Math.min(technicalEvidence*.025,.15);
 const managementRole=managerTerms.some(term=>contains(jobTitle,term)),managementSupported=roles.some(role=>managerTerms.some(term=>contains(role,term)))||String(profile.experience||'').match(/([5-9]|\d{2,})\s*(\+|plus)?\s*years?/i);
 if(managementRole&&!managementSupported)relevance=Math.min(relevance,.5);
 return Math.max(0,Math.min(1,relevance));
}
function years(value){const text=String(value||'');const range=text.match(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*years?/i);if(range)return{min:Number(range[1]),max:Number(range[2])};const plus=text.match(/(\d+(?:\.\d+)?)\s*\+?\s*years?/i);if(plus)return{min:Number(plus[1]),max:null};const plain=text.trim().match(/^\d+(?:\.\d+)?$/);return plain?{min:Number(plain[0]),max:Number(plain[0])}:null}
function experienceComponent(job,profile){const user=years(profile.experience),required=years(`${job.experience||''} ${job.description||''}`);if(!required)return{points:12.5,match:null,required:null,user:user?.min??null};if(!user)return{points:6.25,match:false,required:required.min,user:null};if(user.min>=required.min)return{points:25,match:true,required:required.min,user:user.min};const ratio=Math.max(0,user.min/Math.max(required.min,1));return{points:Math.round(25*ratio*100)/100,match:false,required:required.min,user:user.min}}
function locationComponent(job,profile){const preferred=[...(profile.preferredLocations||[]),profile.location].filter(Boolean);if(!preferred.length)return{points:7.5,match:null};const match=preferred.some(place=>contains(job.location,place)||contains(place,job.location));return{points:match?15:0,match}}
function qualificationComponent(job,profile){const text=normalize(job.description),required=/\b(bachelor|b\.e|btech|b\.tech|master|m\.e|mtech|m\.tech|degree|graduate)\b/i.test(text);if(!required)return{points:2.5,match:null};const match=(profile.education||[]).length>0;return{points:match?5:0,match}}
function otherComponent(job,profile){const preferences=profile.jobTypes||[];if(!preferences.length)return{points:2.5,match:null};const match=preferences.some(type=>canonical(type)===canonical(job.jobType));return{points:match?5:0,match}}
function level(score){return score>=80?'Strong Match':score>=65?'Good Match':score>=40?'Partial Match':'Low Match'}
function calculateJobMatch(job,profile,classification={}){
 const required=statedSkills(job,classification.requiredSkills),preferred=statedSkills(job,classification.preferredSkills).filter(x=>!required.some(r=>r.key===x.key));const all=[...required,...preferred];const user=profileSkills(profile),userKeys=new Set(user.map(x=>x.key));const matched=all.filter(x=>userKeys.has(x.key)),missing=all.filter(x=>!userKeys.has(x.key));
 const requiredRatio=required.length?required.filter(x=>userKeys.has(x.key)).length/required.length:null,preferredRatio=preferred.length?preferred.filter(x=>userKeys.has(x.key)).length/preferred.length:null;let ratio=0;if(requiredRatio!==null&&preferredRatio!==null)ratio=requiredRatio*.8+preferredRatio*.2;else ratio=requiredRatio??preferredRatio??0;
 const skillPoints=Math.round(40*ratio*100)/100,relevance=roleRelevance(job,profile),experience=experienceComponent(job,profile),location=locationComponent(job,profile),qualification=qualificationComponent(job,profile),other=otherComponent(job,profile),titlePoints=Math.round(10*relevance*100)/100;
 let score=Math.round(skillPoints+experience.points+location.points+titlePoints+qualification.points+other.points);let capped=false;if(relevance<.2&&score>20){score=20;capped=true}else if(relevance<.4&&score>35){score=35;capped=true}else if(managerTerms.some(term=>contains(job.title,term))&&relevance<=.5&&score>55){score=55;capped=true}
 return{matchScore:score,score,matchLevel:level(score),level:level(score),roleRelevance:Math.round(relevance*100)/100,skillScore:skillPoints,experienceScore:experience.points,locationScore:location.points,titleScore:titlePoints,qualificationScore:qualification.points,otherScore:other.points,skillsMatched:matched.map(x=>x.label),skillsMissing:missing.map(x=>x.label),experienceMatch:experience.match,locationMatch:location.match,jobTitleMatch:relevance>=.65,qualificationMatch:qualification.match,capped,experienceRequired:experience.required,userExperience:experience.user,requiredSkills:required.map(x=>x.label),preferredSkills:preferred.map(x=>x.label)}
}
module.exports={SCORING_VERSION,calculateJobMatch,canonical};
