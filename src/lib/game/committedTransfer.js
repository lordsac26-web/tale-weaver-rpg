export default async function committedTransfer(data, {loadState,setNarrative,setCustomInput}) {
  if (!data?.transfer_committed) return false;
  await loadState();
  setNarrative(previous => [...previous, {type:'narration',text:data.narrative || `Transfer recorded: ${data.receipt.item_name}.`}]);
  setCustomInput('');
  return true;
}