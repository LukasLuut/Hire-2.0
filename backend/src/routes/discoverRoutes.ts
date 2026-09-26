import { Router } from 'express'
import { AppDataSource } from '../config/data-source'
import { Service } from '../models/Service'
import { ServiceService } from '../services/ServiceService'
import { cityPages, findCityPage } from '../seo/cityPages'

/*
 * Descoberta pública por categoria + cidade (/servicos/<categoria>/<cidade>).
 * Só combinações com oferta real (ver seo/cityPages.ts).
 */
const discoverRouter = Router()
const serviceService = new ServiceService()

// todas as combinações com oferta (links internos e navegação)
discoverRouter.get('/', async (req, res) => {
  try {
    res.json(await cityPages())
  } catch (e: any) {
    res.status(400).json({ message: e?.message ?? 'Erro inesperado' })
  }
})

// uma página: resumo + serviços ativos da categoria com prestador na cidade
discoverRouter.get('/:category/:city', async (req, res) => {
  try {
    const page = await findCityPage(String(req.params.category), String(req.params.city))
    if (!page) return res.status(404).json({ message: 'Ainda não há profissionais desta categoria nesta cidade.' })
    const services = await AppDataSource.getRepository(Service)
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.category', 'c')
      .leftJoinAndSelect('s.provider', 'p')
      .innerJoin('p.user', 'u', 'u.blocked = 0')
      .where('s.active = 1 AND c.id = :cat AND p.baseCity = :city AND COALESCE(p.baseState, \'\') = :state', {
        cat: page.categoryId,
        city: page.city,
        state: page.state,
      })
      .orderBy('s.id', 'DESC')
      .getMany()
    // withStats devolve o prestador só com dados públicos
    const withStats = await serviceService.withStats(services)
    const all = await cityPages()
    res.json({
      ...page,
      services: withStats,
      // links internos: outras categorias na mesma cidade e a mesma categoria em outras cidades
      sameCity: all.filter((p) => p.citySlug === page.citySlug && p.categorySlug !== page.categorySlug),
      sameCategory: all.filter((p) => p.categorySlug === page.categorySlug && p.citySlug !== page.citySlug),
    })
  } catch (e: any) {
    res.status(400).json({ message: e?.message ?? 'Erro inesperado' })
  }
})

export default discoverRouter
