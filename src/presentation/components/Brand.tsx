import { brand } from '../brand.js';

export function Brand() {
  return <div className="brand"><img src="/favicon.svg" alt="" width="36" height="36" /><div><span className="brand-name">{brand.name}</span><span className="brand-endorsement">{brand.endorsement}</span></div></div>;
}
