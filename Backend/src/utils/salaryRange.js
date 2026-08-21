function parseRequestedSalary(value){
  const text=String(value||'').trim();if(!text)return null;
  if(text.endsWith('+'))return{min:Number(text.slice(0,-1)),max:Infinity};
  const[min,max]=text.split('-').map(Number);return Number.isFinite(min)&&Number.isFinite(max)?{min,max}:null;
}

function parseJobSalary(job){
  if(Number.isFinite(job.salaryMin)||Number.isFinite(job.salaryMax))return{min:Number(job.salaryMin??job.salaryMax),max:Number(job.salaryMax??job.salaryMin)};
  const text=String(job.salary||'').toLowerCase(),numbers=(text.match(/\d[\d,]*(?:\.\d+)?/g)||[]).map(value=>Number(value.replaceAll(',','')));if(!numbers.length)return null;
  const multiplier=/\b(lpa|lakh|lakhs)\b/.test(text)?100000:1;
  return{min:numbers[0]*multiplier,max:(numbers[1]??numbers[0])*multiplier};
}

function matchesSalary(job,requested){const target=parseRequestedSalary(requested),salary=parseJobSalary(job);return Boolean(target&&salary&&salary.min<=target.max&&target.min<=salary.max)}
module.exports={parseRequestedSalary,parseJobSalary,matchesSalary};
