export function disputeCustomers(snapshot, value) {
  const query=value.trim().toLowerCase();
  if(query.length<2)return [];
  if(Object.hasOwn(snapshot.searches,query))return snapshot.searches[query].map(id=>snapshot.customers.find(x=>x.id===id));
  return snapshot.customers.filter(row=>[row.name,row.displayName,row.phone,row.email,row.address].some(x=>x.toLowerCase().includes(query))).slice(0,20);
}
export function disputeError(customer, amount) {
  if(!customer)return 'Please select a customer from the search dropdown.';
  if(!(Number(amount)>0))return 'Please enter a valid disputed amount greater than 0.';
  return 'Failed to create dispute: {"detail":"This action is disabled in the read-only demo.","error":"This action is disabled in the read-only demo."}';
}
