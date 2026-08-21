const technologies=['JavaScript','TypeScript','React','Next.js','Node.js','Express','MongoDB','SQL','PostgreSQL','MySQL','HTML','CSS','Tailwind CSS','Python','Java','C++','C#','AWS','Azure','Google Cloud','Docker','Kubernetes','Git','GraphQL','Redux','Figma','Jenkins','Terraform'];
const titlePatterns=['Software Engineer','Software Developer','Frontend Developer','Front End Developer','Backend Developer','Full Stack Developer','Web Developer','React Developer','Node.js Developer','Product Designer','UX Designer','UI Designer','Data Analyst','Data Scientist','Project Manager','Product Manager','DevOps Engineer','Cloud Engineer','QA Engineer','Test Engineer','Intern'];
const headings={summary:/^(professional )?(summary|profile|objective)$/i,skills:/^(technical )?skills( and technologies)?$/i,experience:/^(professional |work )?(experience|employment|work history)$/i,education:/^(education|academic background|qualifications)$/i,projects:/^(projects|personal projects|academic projects)$/i,certifications:/^(certifications?|licenses?( and certifications)?)$/i};
const unique=values=>[...new Set(values.map(value=>value.trim()).filter(Boolean))];
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function sectionLines(lines){const sections={general:[]};let current='general';for(const line of lines){const clean=line.replace(/^[-•▪◦*]+\s*/,'').trim();const match=Object.entries(headings).find(([,pattern])=>pattern.test(clean.replace(/:$/,'')));if(match){current=match[0];sections[current]??=[]}else if(clean){sections[current]??=[];sections[current].push(clean)}}return sections}
function parseResumeText(text){
  const lines=String(text||'').split('\n').map(line=>line.trim());const nonempty=lines.filter(Boolean),sections=sectionLines(lines);
  const email=(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
  const phone=(text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)||[])[0]?.trim()||'';
  const name=nonempty.slice(0,8).find(line=>!line.includes('@')&&!/\d/.test(line)&&!Object.values(headings).some(pattern=>pattern.test(line.replace(/:$/,'')))&&line.split(/\s+/).length>=2&&line.split(/\s+/).length<=5)||'';
  const locationMatch=text.match(/(?:location|address)\s*[:|-]\s*([^\n]+)/i);const location=locationMatch?.[1]?.trim()||'';
  const skillSection=(sections.skills||[]).flatMap(line=>line.split(/[,|•]/));
  const detectedTech=technologies.filter(technology=>new RegExp(`(^|[^a-z0-9+#])${escape(technology)}([^a-z0-9+#]|$)`,'i').test(text));
  const skills=unique([...skillSection,...detectedTech]);
  const jobTitles=unique(titlePatterns.filter(title=>new RegExp(escape(title),'i').test(text)));
  return {name,email,phone,location,summary:(sections.summary||[]).join(' '),skills,experience:unique(sections.experience||[]),education:unique(sections.education||[]),projects:unique(sections.projects||[]),certifications:unique(sections.certifications||[]),jobTitles,technologies:detectedTech};
}
module.exports={parseResumeText};
