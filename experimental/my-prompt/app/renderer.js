const func = async () => {
  const response = await window.api.ping();
  console.log(response);

  const echoResponse = await window.api.echo('Hello, world!');
  const echoElement = document.createElement('div');
  echoElement.textContent = echoResponse;
  document.body.appendChild(echoElement);
};

func();
