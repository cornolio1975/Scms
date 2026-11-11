import {it,expect} from 'vitest';
import {store} from '../store';
it('updates the exact member when siblings share an email across different branches',()=>{
 const originals={members:store.members,users:store.users};
 try {
  store.users=[];
  store.members=[{id:'one',clubId:'club',branchId:'branch-a',fullName:'First Athlete',email:'parent@example.test',sportData:{}},{id:'two',clubId:'club',branchId:'branch-b',fullName:'Second Athlete',email:'parent@example.test',sportData:{}}] as any;
  store.updateMember('two',{fullName:'Second Updated',email:'parent@example.test'},'Test');
  expect(store.members[0].fullName).toBe('First Athlete');expect(store.members[0].branchId).toBe('branch-a');expect(store.members[1].fullName).toBe('Second Updated');expect(store.members[1].branchId).toBe('branch-b');
 }finally{store.members=originals.members;store.users=originals.users;}
});
it('rejects an ambiguous linked user instead of picking the first branch membership',()=>{
 const original=store.members;
 try {
  store.members=[{id:'one',userId:'user',clubId:'club',branchId:'a'},{id:'two',userId:'user',clubId:'club',branchId:'b'}] as any;
  expect(()=>store.updateMember('user',{fullName:'Unsafe'},'Test')).toThrow('exact athlete membership');
 }finally{store.members=original;}
});
