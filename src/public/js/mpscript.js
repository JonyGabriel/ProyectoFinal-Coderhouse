const mp = new MercadoPago('TEST-64939da2-3b86-4840-8e2f-6c374693c554', {
	locale: 'es-AR',
});

document.getElementById('checkout-btn').addEventListener('click', async () => {
	try {
		// Calculate the total price of the cart
		const items = [];
	const rows = document.querySelectorAll('.product');
	rows.forEach((row) => {
  const name = row.querySelector('.name').innerText;
  const quantity = Number(row.querySelector('.quantity').innerText);
  const price = Number(row.querySelector('.price').innerText);
  items.push({ title: name, quantity: isNaN(quantity) ? 0 : quantity, unit_price: price, currency_id: 'ARS' });
});

		const response = await fetch(
			'http://127.0.0.1:8080/api/carts/create_preference',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ items }),
			}
		);

		if (response.ok) {
			const { id } = await response.json();
			createCheckoutButton(id);
		} else {
			throw new Error('Response is not OK');
		}
	} catch (error) {
		alert('Error al crear la preferencia: ' + error.message);
	}
});

const createCheckoutButton = (preferenceId) => {
	const bricksBuilder = mp.bricks();

	const renderComponent = async () => {
		if (window.checkoutButton) window.checkoutButton.unmount();
		await bricksBuilder.create('wallet', 'wallet_container', {
			initialization: {
				preferenceId: preferenceId,
				redirectMode:'blank',
			},
		});
	};

	renderComponent();
};
