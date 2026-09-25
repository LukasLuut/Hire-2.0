import { Request, Response } from "express";
import { HireService } from "../services/HireService";

const hireService = new HireService;

const userId = (req: Request) => Number((req as any).user.id);
const fail = (res: Response, err: any, fallback = 400) =>
    res.status(err?.status ?? fallback).json({ message: err?.message ?? "Erro inesperado" });

export class HireController {
    create = async (req: Request, res: Response) => {
        try {
            const firstContact: Date = new Date();
            const hire = await hireService.create({ ...req.body, firstContact }, userId(req));
            res.status(201).json(hire);
        }
        catch(err: any) {
            fail(res, err);
        }
    }

    bookedSlots = async (req: Request, res: Response) => {
        try {
            res.json(await hireService.bookedSlots(Number(req.params.serviceId)));
        }
        catch(err: any) {
            fail(res, err);
        }
    }

    getById = async (req: Request, res: Response) => {
        try {
            const hire = await hireService.getById(Number(req.params.id), userId(req));
            res.json(hire);
        }
        catch(err: any) {
            fail(res, err, 404);
        }
    }

    getMine = async (req: Request, res: Response) => {
        try {
            const hires = await hireService.getListByUserId(userId(req));
            res.json(hires);
        }
        catch(err: any) {
            fail(res, err);
        }
    }

    getByProviderId = async(req: Request, res: Response) => {
        try {
            const hires = await hireService.getListByProviderId(Number(req.params.id), userId(req));
            res.json(hires);
        }
        catch(err: any) {
            fail(res, err);
        }
    }

    update = async (req: Request, res: Response) => {
        try {
            const hire = await hireService.update(Number(req.params.id), req.body, userId(req));
            res.json(hire);
        } catch (e: any) {
            fail(res, e);
        }
    }

    delete = async (req: Request, res: Response) => {
        try {
            const result = await hireService.remove(Number(req.params.id), userId(req));
            res.json(result);
        } catch (e: any) {
            fail(res, e, 404);
        }
    }
}
