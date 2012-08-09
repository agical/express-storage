function go() {
  document.getElementById('allow').style.display='none';
  document.getElementById('wait').style.display='block';
  document.getElementById('assertion').value=assertion;
  document.forms[0].submit();
}

