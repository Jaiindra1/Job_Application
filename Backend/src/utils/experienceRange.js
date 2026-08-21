function parseExperienceRange(value){
  const text=String(value||'').toLowerCase().trim();if(!text)return null;
  const numbers=(text.match(/\d+(?:\.\d+)?/g)||[]).map(Number);if(!numbers.length)return null;
  if(/\+|plus|above|more than|minimum|at least/.test(text))return{min:numbers[0],max:Infinity};
  if(numbers.length>1)return{min:Math.min(numbers[0],numbers[1]),max:Math.max(numbers[0],numbers[1])};
  return{min:numbers[0],max:numbers[0]};
}
function rangesOverlap(left,right){return Boolean(left&&right&&left.min<=right.max&&right.min<=left.max)}
function matchesExperience(value,requested){const target=parseExperienceRange(requested);if(!target)return true;const candidates=String(value||'').match(/\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*(?:years?|yrs?)|\d+(?:\.\d+)?\s*(?:\+|plus)?\s*(?:years?|yrs?)/gi)||[];return candidates.some(item=>rangesOverlap(parseExperienceRange(item),target))}
module.exports={parseExperienceRange,rangesOverlap,matchesExperience};
