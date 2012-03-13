function go() {
  document.getElementById('allow').style.display='none';
  document.getElementById('wait').style.display='block';
  navigator.id.get(function(assertion) {
    document.getElementById('assertion').value=assertion;
    document.forms[0].submit();
  }, {
    requiredEmail: 'michiel@unhosted.org'
  });
}
