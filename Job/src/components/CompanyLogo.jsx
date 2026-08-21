const palettes=[['#087cff','#59a8ff'],['#00a86b','#42dfa8'],['#ff6b35','#ffad42'],['#6548e8','#a688ff'],['#ed315d','#ff7691']];

export default function CompanyLogo({name='Company',size='md',className=''}){
  const label=String(name||'Company').trim();
  const initials=label.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'CO';
  const index=[...label].reduce((sum,char)=>sum+char.charCodeAt(0),0)%palettes.length;
  const [from,to]=palettes[index];
  const dimensions=size==='lg'?'w-16 h-16 text-xl':size==='sm'?'w-10 h-10 text-sm':'w-12 h-12 text-base';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="96" height="96" rx="22" fill="url(#g)"/><circle cx="75" cy="20" r="18" fill="white" opacity=".12"/><text x="48" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="31" font-weight="700" fill="white">${initials}</text></svg>`;
  return <img src={`data:image/svg+xml,${encodeURIComponent(svg)}`} alt={`${label} logo`} className={`${dimensions} rounded-xl shadow-sm shrink-0 ${className}`} />;
}
