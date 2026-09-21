const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.post('/', async (req, res) => {
    try {
        const { store_id, review_date, home_page, blog, pdp, cart, checkout, reviewer_name, observations } = req.body;
        
        await db('manual_reviews').insert({
            store_id,
            review_date,
            home_page: String(home_page),
            blog: String(blog),
            pdp: String(pdp),
            cart: String(cart),
            checkout: String(checkout),
            reviewer_name,
            observations
        });

        res.json({ success: true, message: 'Revisión guardada correctamente' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/all', async (req, res) => {
    try {
        const reviews = await db('manual_reviews')
            .join('stores', 'manual_reviews.store_id', 'stores.id')
            .select('manual_reviews.*', 'stores.name as store_name')
            .orderBy('review_date', 'desc');
            
        res.json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.get('/:storeId', async (req, res) => {
    try {
        const { storeId } = req.params;
        const reviews = await db('manual_reviews')
            .where({ store_id: storeId })
            .orderBy('review_date', 'desc');
            
        res.json({ success: true, data: reviews });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;