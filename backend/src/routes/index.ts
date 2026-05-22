import { Router } from 'express'
import paymentRoutes from './payment.routes'
import authRoutes from './auth.routes'
import cartRoutes from './cart.routes'
import companyRoutes from './company.routes'
import orderRoutes from './order.routes'
import notificationRoutes from './notification.routes'
import reviewRoutes from './review.routes'
import publicRoutes from './public.routes'
import adminRoutes from './admin.routes'
import deliveryRoutes from './delivery.routes'


const router = Router()

router.get('/health', (_, res) => {
  res.json({ status: 'API running' })
})

router.use('/payments', paymentRoutes)
router.use('/auth', authRoutes)
router.use('/cart', cartRoutes)
router.use('/company', companyRoutes)
router.use('/orders', orderRoutes)
router.use('/notifications', notificationRoutes)
router.use('/reviews', reviewRoutes)
router.use('/public', publicRoutes)
router.use('/admin', adminRoutes)
router.use('/delivery', deliveryRoutes)

export default router