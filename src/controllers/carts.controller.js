import {
	cartsService,
	productsService,
	ticketsService,
} from '../services/index.js';
import { PERSISTENCE } from '../config/config.js';
import Mail from '../modules/mail.module.js';
import moment from 'moment';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const mail = new Mail();
const client = new MercadoPagoConfig({
	accessToken:
		'TEST-6769129066925551-032319-cba08c8c83a930e8573509e0629f127d-387993007',
});

export const getCartById = async (req, res) => {
	try {
		const { cid } = req.params;
		const result = await cartsService.getCartById(cid);
		res.status(result ? 200 : 404).json({
			status: result ? 'success' : 'error',
			payload: result,
		});
	} catch (e) {
		req.logger.error('Error: ' + e);
		if (e.name == 'CastError') return res.status(404).send('Not found');
		res.status(500).send('Server error');
	}
};

export const addCart = async (req, res) => {
	try {
		const result = await cartsService.addCart(req.body);
		res.json({ status: result ? 'success' : 'error', payload: result });
	} catch (e) {
		req.logger.error('Error: ' + e);
		res.status(500).send('Server error');
	}
};

export const updateCartProducts = async (req, res) => {
	try {
		if (!req.body)
			return res.status(400).json({
				status: 'error',
				payload: "there aren't products specified",
			});
		const result = await cartsService.updateCartProducts(
			req.params?.cid,
			req.body?.products
		);
		res.status(result.modifiedCount ? 200 : 404).json({
			stauts: result.modifiedCount ? 'success' : 'error',
			payload: result,
		});
	} catch (e) {
		req.logger.error('Error: ' + e);
		if (e.name == 'CastError') return res.status(404).send('Not found');
		res.status(500).send('Server error');
	}
};

export const updateProductFromCart = async (req, res) => {
	try {
		const {
			params: { pid, cid },
			body: { quantity },
			user: { user },
		} = req;

		if (user.role != 'user') {
			const product = await productsService.getProductById(pid);
			if (product.owner == (user?._id || user?.id))
				return res.status(400).send('This is your product');
		}

		const result = await cartsService.updateProductFromCart(
			pid,
			cid,
			quantity
		);
		res.status(result.modifiedCount ? 200 : 404).json({
			stauts: result.modifiedCount ? 'success' : 'error',
			payload: result,
		});
	} catch (e) {
		req.logger.error('Error: ' + e);
		if (e.name == 'CastError') return res.status(404).send('Not found');
		res.status(500).send('Server error');
	}
};

export const deleteProductFromCart = async (req, res) => {
	try {
		const { cid, pid } = req.params;
		const result = await cartsService.deleteProductFromCart(cid, pid);
		res.status(result.modifiedCount ? 200 : 404).json({
			stauts: result.modifiedCount ? 'success' : 'error',
			payload: result,
		});
	} catch (e) {
		req.logger.error('Error: ' + e);
		if (e.name == 'CastError') return res.status(404).send('Not found');
		res.status(500).send('Server error');
	}
};

export const deleteProducts = async (req, res) => {
	try {
		const result = await cartsService.deleteCartProducts(req.params?.cid);
		res.status(result.modifiedCount ? 200 : 404).json({
			stauts: result.modifiedCount ? 'success' : 'error',
			payload: result,
		});
	} catch (e) {
		req.logger.error('Error: ' + e);
		if (e.name == 'CastError') return res.status(404).send('Not found');
		res.status(500).send('Server error');
	}
};

export const purchaseCart = async (req, res) => {
	try {
		const { cid } = req.params;
		const cart = await cartsService.getCartById(cid);

		const unavailableProducts = [];
		const purchasedProducts = [];

		await Promise.all(
			cart.products.map(async (p) => {
				if (PERSISTENCE == 'MONGO')
					p.product.stock >= p.quantity
						? (await productsService.updateProduct(p.product._id, {
								stock: p.product.stock - p.quantity,
						  }),
						  purchasedProducts.push(p))
						: unavailableProducts.push(p);
				else {
					const product = await productsService.getProductById(p.id);
					product.stock >= p.quantity
						? (await productsService.updateProduct(product.id, {
								stock: product.stock - p.quantity,
						  }),
						  purchasedProducts.push({ ...p, product }))
						: unavailableProducts.push(p);
				}
			})
		);

		const ticket = {
			purchase_datetime: moment().format('YYYY-MM-DD hh:mm:ss'),
			amount: purchasedProducts.reduce((acc, p) => {
				return acc + p?.product?.price * p.quantity;
			}, 0),
			purchaser: req?.user?.user?.email,
		};
		const ticketResult = await ticketsService.createTicket(ticket);

		const cartUpdateProducts = await cartsService.updateCartProducts(
			cid,
			unavailableProducts
		);

		mail.send(req?.user?.user?.email, "Compra realizada", `<h1>Relizaste una compra, muchas gracias por comprar en Compu SV</h1> <p>${JSON.stringify(purchasedProducts)}</p>`)

		res.json({
			status: 'success',
			payload: unavailableProducts.length
				? unavailableProducts
				: ticketResult,
		});
	} catch (e) {
		req.logger.error('Error: ' + e);
		if (e.name == 'CastError') return res.status(404).send('Not found');
		res.status(500).send('Server error');
	}
};
	
export const createPreference = async (req, res) => {
	try {
		if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
			throw new Error('No items provided for preference creation');
	}
		const body = {
			items: req.body.items,
			back_urls: {
				success: '/products',
				failure: '/products',
				pending: '/products',
			},
			auto_return: 'approved',
			notification_url: "https://e5b7-38-10-113-39.ngrok-free.app/webhook"
		};

		const preference = new Preference(client);
		const result = await preference.create({ body });
		res.json({
			id: result.id,
		});
	} catch (error) {
		console.log(error);
		res.status(500).json({
			error: 'Error al crear una preferencia:(' + error.message,
		});
	}
};
export const webLogs = async (req, res) => {
	const paymentId = req.query.payment_id;
	try {
		const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
			method:'GET',
			headers:{
				'Authorization': `Bearer ${client.accessToken}`
			}
		});

		if (response.ok){
			const data = await response.json();
			console.log(data);

			// Envía el correo electrónico con los detalles de la compra
			const mail = new Mail();
			const subject = 'Detalles de la compra';
			const html = `
				<h1>Relizaste una compra, muchas gracias por comprar en Compu SV</h1>
				<p><strong>ID de pago:</strong> ${data.id}</p>
				<p><strong>Estado del pago:</strong> ${data.status}</p>
				<p><strong>Fecha y hora del pago:</strong> ${data.date_created}</p>
				<p><strong>Monto del pago:</strong> ${data.transaction_amount}</p>
				<p><strong>Descripción del pago:</strong> ${data.description}</p>
				<p><strong>Correo electrónico del pagador:</strong> ${data.payer.email}</p>
			`;
			mail.send(data.payer.email, subject, html);
		}

		res.sendStatus(200);
	} catch (error) {
		console.error('Error:', error);
		res.sendStatus(500);
	}
}
