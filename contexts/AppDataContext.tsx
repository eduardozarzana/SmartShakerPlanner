import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Equipment, Product, ProductionLine, ScheduledProductionRun, OperatingDayTime, 
  ProductClassification, ScheduleStatus, LinePauseHistoryEntry 
} from '../types';
import { generateUUID } from '../utils/uuid';
import { useAuth } from './AuthContext'; // Import useAuth to get current user

// --- Tipos do Banco de Dados (snake_case) ---
interface DbEquipment {
  id: string;
  name: string;
  type: string;
  maintenance_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface DbProduct {
  id: string;
  name: string;
  sku: string;
  description: string;
  ingredients?: string[];
  processing_times: Array<{ equipmentId: string; timePerUnitMinutes: number; }>; // JSONB
  classification: ProductClassification;
  manufactured_for?: string;
  gantt_bar_color?: string; // Added color field
  created_at?: string;
  updated_at?: string;
}

interface DbProductionLine {
  id: string;
  name: string;
  description?: string;
  equipment_ids: string[]; // UUID[]
  operating_hours: OperatingDayTime[]; // JSONB
  display_order?: number;
  created_at?: string;
  updated_at?: string;
  // Pause fields
  is_paused?: boolean;
  current_pause_start_time?: string | null;
  current_pause_reason?: string | null;
  paused_by_user_email?: string | null;
}

interface DbScheduledProductionRun {
  id: string;
  product_id: string;
  line_id: string;
  start_time: string;
  end_time: string;
  quantity: number;
  notes?: string;
  status: ScheduleStatus;
  created_at?: string;
  updated_at?: string;
  interruption_pause_start_time?: string | null;
  interruption_pause_end_time?: string | null;
}

interface DbLinePauseHistoryEntry {
  id: string;
  line_id: string;
  paused_by_user_email: string;
  pause_start_time: string;
  pause_end_time: string;
  pause_reason?: string | null;
  duration_minutes: number;
  created_at: string;
}


// --- Funções de Mapeamento ---
const mapDbToEquipment = (db: DbEquipment): Equipment => ({
  id: db.id,
  name: db.name,
  type: db.type,
  maintenanceDate: db.maintenance_date,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapEquipmentToDb = (eq: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbEquipment, 'id' | 'created_at' | 'updated_at'> => ({
  name: eq.name,
  type: eq.type,
  maintenance_date: eq.maintenanceDate,
});

const mapDbToProduct = (db: DbProduct): Product => ({
  id: db.id,
  name: db.name,
  sku: db.sku,
  description: db.description,
  ingredients: db.ingredients || [],
  processingTimes: db.processing_times || [],
  classification: db.classification,
  manufacturedFor: db.manufactured_for,
  ganttBarColor: db.gantt_bar_color,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const mapProductToDb = (p: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbProduct, 'id' | 'created_at' | 'updated_at'> => ({
  name: p.name,
  sku: p.sku,
  description: p.description,
  ingredients: p.ingredients,
  processing_times: p.processingTimes,
  classification: p.classification,
  manufactured_for: p.manufacturedFor,
  gantt_bar_color: p.ganttBarColor,
});

const mapDbToProductionLine = (db: DbProductionLine): ProductionLine => ({
  id: db.id,
  name: db.name,
  description: db.description,
  equipmentIds: db.equipment_ids || [],
  operatingHours: db.operating_hours || [],
  displayOrder: db.display_order ?? 0,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  isPaused: db.is_paused,
  currentPauseStartTime: db.current_pause_start_time,
  currentPauseReason: db.current_pause_reason,
  pausedByUserEmail: db.paused_by_user_email,
});

const mapProductionLineToDb = (pl: Omit<ProductionLine, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbProductionLine, 'id' | 'created_at' | 'updated_at'> => ({
  name: pl.name,
  description: pl.description,
  equipment_ids: pl.equipmentIds,
  operating_hours: pl.operatingHours,
  display_order: pl.displayOrder,
  is_paused: pl.isPaused,
  current_pause_start_time: pl.currentPauseStartTime,
  current_pause_reason: pl.currentPauseReason,
  paused_by_user_email: pl.pausedByUserEmail,
});

const mapDbToScheduledRun = (db: DbScheduledProductionRun): ScheduledProductionRun => ({
  id: db.id,
  productId: db.product_id,
  lineId: db.line_id,
  startTime: db.start_time,
  endTime: db.end_time,
  quantity: db.quantity,
  notes: db.notes,
  status: db.status,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
  interruptionPauseStartTime: db.interruption_pause_start_time,
  interruptionPauseEndTime: db.interruption_pause_end_time,
});

const mapScheduledRunToDb = (sr: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>): Omit<DbScheduledProductionRun, 'id' | 'created_at' | 'updated_at'> => ({
  product_id: sr.productId,
  line_id: sr.lineId,
  start_time: sr.startTime,
  end_time: sr.endTime,
  quantity: sr.quantity,
  notes: sr.notes,
  status: sr.status,
  interruption_pause_start_time: sr.interruptionPauseStartTime,
  interruption_pause_end_time: sr.interruptionPauseEndTime,
});

// Helper: Convert HH:MM string to total minutes from midnight
const timeStringToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};
const daysOfWeekNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

interface AppDataContextType {
  equipment: Equipment[];
  addEquipment: (item: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEquipment: (item: Equipment) => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  getEquipmentById: (id: string) => Equipment | undefined;

  products: Product[];
  addProduct: (item: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (item: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;

  productionLines: ProductionLine[];
  addProductionLine: (item: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>) => Promise<ProductionLine | null>;
  updateProductionLine: (item: ProductionLine, shouldRefetch?: boolean) => Promise<ProductionLine | null>;
  updateProductionLinesOrder: (lines: ProductionLine[]) => Promise<void>;
  deleteProductionLine: (id: string) => Promise<void>;
  getProductionLineById: (id: string) => ProductionLine | undefined;
  pauseLine: (lineId: string, reason: string) => Promise<{ success: boolean; message?: string }>;
  resumeLine: (lineId: string) => Promise<{ success: boolean; message?: string }>;


  schedules: ScheduledProductionRun[];
  addSchedule: (item: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSchedule: (item: ScheduledProductionRun, shouldRefetch?: boolean) => Promise<ScheduledProductionRun | null>;
  deleteSchedule: (id: string) => Promise<void>;
  getScheduleById: (id: string) => ScheduledProductionRun | undefined;
  finishScheduleNow: (scheduleId: string) => Promise<{ success: boolean; message?: string }>;
  
  optimizeDaySchedules: (dateToOptimize: Date, targetLineId?: string) => Promise<{
    optimizedCount: number;
    unoptimizedCount: number;
    details: string[];
  }>;

  addWorkingTime: (baseDate: Date, minutesToAdd: number, line: ProductionLine) => Date;
  calculateEffectiveWorkDuration: (startTime: Date, endTime: Date, line: ProductionLine) => number;

  linePauseHistory: LinePauseHistoryEntry[]; 

  isLoading: boolean;
  error: Error | null;
  fetchInitialData: () => Promise<void>;
  hasDisplayOrderFeature: boolean;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth(); 
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [schedules, setSchedules] = useState<ScheduledProductionRun[]>([]);
  const [linePauseHistory, setLinePauseHistory] = useState<LinePauseHistoryEntry[]>([]);
  
  const [hasDisplayOrderFeature, setHasDisplayOrderFeature] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState<Error | null>(null);

  const handleError = useCallback((operation: string, error: any, publicMessage?: string) => {
    let message = `AppDataContext: Error during ${operation}. Message: ${error?.message || 'N/A'}. Details:`;
    try {
      message += ` ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
    } catch (e) {
      message = `AppDataContext: Error during ${operation}. Raw error: ${error}`;
    }
    console.error(message);
    const resolvedMessage = publicMessage || `Falha durante ${operation}. Por favor, tente novamente. Detalhe: ${error?.message || 'Erro desconhecido'}`;
    setErrorState(new Error(resolvedMessage));
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setErrorState(null);
    try {
      const { data: equipmentData, error: equipmentError } = await supabase.from('equipment').select('*').order('name');
      if (equipmentError) throw equipmentError;
      setEquipment(equipmentData.map(mapDbToEquipment));

      const { data: productsData, error: productsError } = await supabase.from('products').select('*').order('name');
      if (productsError) throw productsError;
      setProducts(productsData.map(mapDbToProduct));

      const { data: linesData, error: linesError } = await supabase.from('production_lines').select('*').order('display_order', { nullsFirst: true }).order('name');
      if (linesError) {
        if (linesError.code === '42703' && linesError.message.includes('display_order')) {
          console.warn("SmartShaker Dev Message: A coluna 'display_order' não foi encontrada na tabela 'production_lines'. O recurso de ordenação manual de linhas não será persistido. Para habilitar, adicione uma coluna numérica chamada 'display_order' à sua tabela 'production_lines' no Supabase.");
          setHasDisplayOrderFeature(false);
          const { data: fallbackLinesData, error: fallbackLinesError } = await supabase.from('production_lines').select('*').order('name');
          if (fallbackLinesError) throw fallbackLinesError;
          setProductionLines(fallbackLinesData.map(mapDbToProductionLine));
        } else {
          throw linesError;
        }
      } else {
        setHasDisplayOrderFeature(true);
        setProductionLines(linesData.map(mapDbToProductionLine));
      }
      
      const { data: schedulesData, error: schedulesError } = await supabase.from('scheduled_production_runs').select('*').order('start_time');
      if (schedulesError) throw schedulesError;
      setSchedules(schedulesData.map(mapDbToScheduledRun));

      const { data: pauseHistoryData, error: pauseHistoryError } = await supabase.from('line_pause_history').select('*').order('pause_start_time', { ascending: false });
      if (pauseHistoryError) throw pauseHistoryError;
      setLinePauseHistory(pauseHistoryData.map((dbEntry: DbLinePauseHistoryEntry) => ({
        id: dbEntry.id,
        lineId: dbEntry.line_id,
        pausedByUserEmail: dbEntry.paused_by_user_email,
        pauseStartTime: dbEntry.pause_start_time,
        pauseEndTime: dbEntry.pause_end_time,
        pauseReason: dbEntry.pause_reason,
        durationMinutes: dbEntry.duration_minutes,
        createdAt: dbEntry.created_at,
      })));


    } catch (e: any) {
       handleError('fetchInitialData', e);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]); 

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // --- Equipment Operations ---
  const addEquipmentOp = useCallback(async (item: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbItem = mapEquipmentToDb(item);
    const { data, error: eqError } = await supabase.from('equipment').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (eqError) { handleError('addEquipment', eqError); return; }
    if (data) setEquipment(prev => [...prev, mapDbToEquipment(data as DbEquipment)].sort((a,b) => a.name.localeCompare(b.name)));
  }, [handleError]);

  const updateEquipmentOp = useCallback(async (item: Equipment) => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapEquipmentToDb(rest);
    const { data, error: eqError } = await supabase.from('equipment').update(dbItem).eq('id', id).select().single();
    if (eqError) { handleError('updateEquipment', eqError); return; }
    if (data) {
      setEquipment(prev => prev.map(e => e.id === id ? mapDbToEquipment(data as DbEquipment) : e).sort((a,b) => a.name.localeCompare(b.name)));
    }
  }, [handleError]);

  const deleteEquipmentOp = useCallback(async (id: string) => {
    const productsToUpdate = products.filter(p => p.processingTimes.some(pt => pt.equipmentId === id));
    for (const prod of productsToUpdate) {
        const newProcessingTimes = prod.processingTimes.filter(pt => pt.equipmentId !== id);
        const { error: productUpdateError } = await supabase
            .from('products')
            .update({ processing_times: newProcessingTimes, updated_at: new Date().toISOString() })
            .eq('id', prod.id);
        if (productUpdateError) {
            handleError('deleteEquipment (product update)', productUpdateError, `Erro ao remover equipamento de "${prod.name}".`);
            return; 
        }
    }
    setProducts(prevProducts => prevProducts.map(p => {
        if (productsToUpdate.some(ptu => ptu.id === p.id)) {
            return { ...p, processingTimes: p.processingTimes.filter(pt => pt.equipmentId !== id) };
        }
        return p;
    }));

    const linesToUpdate = productionLines.filter(l => l.equipmentIds.includes(id));
    for (const line of linesToUpdate) {
        const newEquipmentIds = line.equipmentIds.filter(eqId => eqId !== id);
        const { error: lineUpdateError } = await supabase
            .from('production_lines')
            .update({ equipment_ids: newEquipmentIds, updated_at: new Date().toISOString() })
            .eq('id', line.id);
        if (lineUpdateError) {
            handleError('deleteEquipment (line update)', lineUpdateError, `Erro ao remover equipamento da linha "${line.name}".`);
            return; 
        }
    }
    setProductionLines(prevLines => prevLines.map(l => {
        if (linesToUpdate.some(ltu => ltu.id === l.id)) {
            return { ...l, equipmentIds: l.equipmentIds.filter(eqId => eqId !== id) };
        }
        return l;
    }));

    const { error: eqError } = await supabase.from('equipment').delete().eq('id', id);
    if (eqError) { handleError('deleteEquipment', eqError); return; }
    setEquipment(prev => prev.filter(e => e.id !== id));
  }, [products, productionLines, handleError]);
  
  const getEquipmentByIdOp = useCallback((id: string): Equipment | undefined => equipment.find(e => e.id === id), [equipment]);

  // --- Product Operations ---
  const addProductOp = useCallback(async (item: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbItem = mapProductToDb(item);
    const { data, error: pError } = await supabase.from('products').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (pError) { handleError('addProduct', pError); return; }
    if (data) setProducts(prev => [...prev, mapDbToProduct(data as DbProduct)].sort((a,b) => a.name.localeCompare(b.name)));
  }, [handleError]);

  const updateProductOp = useCallback(async (item: Product) => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapProductToDb(rest);
    const { data, error: pError } = await supabase.from('products').update(dbItem).eq('id', id).select().single();
    if (pError) { handleError('updateProduct', pError); return; }
    if (data) {
      setProducts(prev => prev.map(p => p.id === id ? mapDbToProduct(data as DbProduct) : p).sort((a,b) => a.name.localeCompare(b.name)));
    }
  }, [handleError]);

  const deleteProductOp = useCallback(async (id: string) => {
    const schedulesToDelete = schedules.filter(s => s.productId === id);
    for (const sch of schedulesToDelete) {
        const { error: scheduleDeleteError } = await supabase.from('scheduled_production_runs').delete().eq('id', sch.id);
        if (scheduleDeleteError) {
            handleError('deleteProduct (schedule deletion)', scheduleDeleteError, `Erro ao deletar agendamento para produto ID ${id}.`);
            return; 
        }
    }
    setSchedules(prevSchedules => prevSchedules.filter(s => s.productId !== id));

    const { error: pError } = await supabase.from('products').delete().eq('id', id);
    if (pError) { handleError('deleteProduct', pError); return; }
    setProducts(prev => prev.filter(p => p.id !== id));
  }, [schedules, handleError]);
  
  const getProductByIdOp = useCallback((id: string): Product | undefined => products.find(p => p.id === id), [products]);

  // --- Production Line Operations ---
  const addProductionLineOp = useCallback(async (item: Pick<ProductionLine, 'name' | 'description' | 'operatingHours'>): Promise<ProductionLine | null> => {
    const maxOrder = productionLines.reduce((max, line) => Math.max(max, line.displayOrder), -1);
    const newLineData: Omit<ProductionLine, 'id' | 'createdAt' | 'updatedAt'> = {
        ...item,
        equipmentIds: [],
        displayOrder: maxOrder + 1,
    };
    const dbItem = mapProductionLineToDb(newLineData);
    if (!hasDisplayOrderFeature) {
        delete (dbItem as Partial<DbProductionLine>).display_order;
    }
    const { data, error: plError } = await supabase.from('production_lines').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (plError) { handleError('addProductionLine', plError); return null; }
    if (data) {
        const newLine = mapDbToProductionLine(data as DbProductionLine);
        setProductionLines(prev => [...prev, newLine].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)));
        return newLine;
    }
    return null;
  }, [handleError, productionLines, hasDisplayOrderFeature]);

  const updateProductionLineOp = useCallback(async (item: ProductionLine, shouldRefetch: boolean = false): Promise<ProductionLine | null> => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapProductionLineToDb(rest);
    if (!hasDisplayOrderFeature) {
        delete (dbItem as Partial<DbProductionLine>).display_order;
    }
    const { data, error: plError } = await supabase.from('production_lines').update(dbItem).eq('id', id).select().single();
    if (plError) { handleError('updateProductionLine', plError); return null; }
    if (data) {
        const updatedLine = mapDbToProductionLine(data as DbProductionLine);
        setProductionLines(prev => prev.map(l => l.id === id ? updatedLine : l).sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)));
        if (shouldRefetch) await fetchInitialData(); 
        return updatedLine;
    }
    return null;
  }, [handleError, fetchInitialData, hasDisplayOrderFeature]);

  const updateProductionLinesOrderOp = useCallback(async (orderedLines: ProductionLine[]) => {
    // Optimistically update the UI
    const reorderedLinesWithIndex = orderedLines.map((line, index) => ({ ...line, displayOrder: index }));
    setProductionLines(reorderedLinesWithIndex);

    if (!hasDisplayOrderFeature) {
        return;
    }

    // Prepare full objects for upsert to avoid not-null constraint violations
    const updates = reorderedLinesWithIndex.map(line => {
      const { id, createdAt, updatedAt, ...rest } = line;
      const dbItem = mapProductionLineToDb(rest);
      // The upsert needs the primary key `id` to identify which row to update.
      return { id, ...dbItem }; 
    });
    
    const { error: updateError } = await supabase.from('production_lines').upsert(updates);
    
    if (updateError) {
        handleError('updateProductionLinesOrder', updateError, 'Falha ao atualizar a ordem das linhas.');
        // Revert optimistic update on error by fetching fresh data
        await fetchInitialData(); 
        return;
    }
  }, [handleError, fetchInitialData, hasDisplayOrderFeature]);

  const deleteProductionLineOp = useCallback(async (id: string) => {
    const schedulesOnLine = schedules.filter(s => s.lineId === id);
    for (const sch of schedulesOnLine) {
        const { error: scheduleDeleteError } = await supabase.from('scheduled_production_runs').delete().eq('id', sch.id);
        if (scheduleDeleteError) {
            handleError('deleteProductionLine (schedule deletion)', scheduleDeleteError, `Erro ao deletar agendamentos da linha ID ${id}.`);
            return; 
        }
    }
    setSchedules(prevSchedules => prevSchedules.filter(s => s.lineId !== id));

    const { error: plError } = await supabase.from('production_lines').delete().eq('id', id);
    if (plError) { handleError('deleteProductionLine', plError); return; }
    setProductionLines(prev => prev.filter(l => l.id !== id));
  }, [schedules, handleError]);
  
  const getProductionLineByIdOp = useCallback((id: string): ProductionLine | undefined => productionLines.find(l => l.id === id), [productionLines]);

  // --- Schedule Operations ---
  const addScheduleOp = useCallback(async (item: Omit<ScheduledProductionRun, 'id' | 'createdAt' | 'updatedAt'>) => {
    const dbItem = mapScheduledRunToDb(item);
    const { data, error: sError } = await supabase.from('scheduled_production_runs').insert({ ...dbItem, id: generateUUID() }).select().single();
    if (sError) { handleError('addSchedule', sError); return; }
    if (data) {
        const newSchedule = mapDbToScheduledRun(data as DbScheduledProductionRun);
        setSchedules(prev => [...prev, newSchedule].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
    }
  }, [handleError]);

  const updateScheduleOp = useCallback(async (item: ScheduledProductionRun, shouldRefetch: boolean = false): Promise<ScheduledProductionRun | null> => {
    const { id, createdAt, updatedAt, ...rest } = item;
    const dbItem = mapScheduledRunToDb(rest);
    const { data, error: sError } = await supabase.from('scheduled_production_runs').update(dbItem).eq('id', id).select().single();
    if (sError) { handleError('updateSchedule', sError); return null; }
    if (data) {
        const updatedSchedule = mapDbToScheduledRun(data as DbScheduledProductionRun);
        setSchedules(prev => prev.map(s => s.id === id ? updatedSchedule : s).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        if (shouldRefetch) await fetchInitialData();
        return updatedSchedule;
    }
    return null;
  }, [handleError, fetchInitialData]);

  const deleteScheduleOp = useCallback(async (id: string) => {
    const { error: sError } = await supabase.from('scheduled_production_runs').delete().eq('id', id);
    if (sError) { handleError('deleteSchedule', sError); return; }
    setSchedules(prev => prev.filter(s => s.id !== id));
  }, [handleError]);

  const getScheduleByIdOp = useCallback((id: string): ScheduledProductionRun | undefined => schedules.find(s => s.id === id), [schedules]);


  // --- PAUSE/RESUME LOGIC ---
  const pauseLineOp = useCallback(async (lineId: string, reason: string): Promise<{ success: boolean; message?: string }> => {
    const lineToPause = productionLines.find(l => l.id === lineId);
    if (!lineToPause || !user) {
      const msg = !lineToPause ? "Linha não encontrada." : "Usuário não autenticado.";
      handleError('pauseLine', new Error(msg));
      return { success: false, message: msg };
    }
    const updatePayload = {
      is_paused: true,
      current_pause_start_time: new Date().toISOString(),
      current_pause_reason: reason,
      paused_by_user_email: user.email,
    };
    const { error: pauseError } = await supabase.from('production_lines').update(updatePayload).eq('id', lineId);
    
    if (pauseError) {
      let publicMsg = `Falha ao pausar a linha "${lineToPause.name}".`;
      if (pauseError.message.includes("schema cache") && pauseError.message.includes("column")) {
          const match = pauseError.message.match(/the '([^']+)' column/);
          const columnName = match && match[1] ? match[1] : "desconhecida";
          publicMsg = `A coluna "${columnName}" não foi encontrada no cache do esquema do banco de dados. Verifique a estrutura da tabela no Supabase e tente um "hard refresh" (Ctrl+Shift+R). Se persistir, recarregue o esquema na seção API das configurações do seu projeto Supabase. Detalhe original: ${pauseError.message}`;
      } else {
          publicMsg += ` Detalhe: ${pauseError.message}`;
      }
      handleError('pauseLine', pauseError, publicMsg);
      return { success: false, message: publicMsg };
    }

    // Refetch all data to ensure the UI is in sync everywhere, preventing visual bugs.
    await fetchInitialData();
    
    return { success: true, message: `Linha "${lineToPause.name}" pausada com sucesso.` };
  }, [productionLines, user, handleError, fetchInitialData]);

  const addWorkingTime = useCallback((baseDate: Date, minutesToAdd: number, line: ProductionLine): Date => {
    let newDate = new Date(baseDate);
    let remainingMinutesToAdd = minutesToAdd;
    let safetyBreak = 100000; 

    while (remainingMinutesToAdd > 0 && safetyBreak > 0) {
      safetyBreak--;
      const dayOfWeek = newDate.getDay();
      const operatingDay = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);

      if (operatingDay && operatingDay.isActive) {
        const opStartTimeMinutesToday = timeStringToMinutes(operatingDay.startTime);
        const opEndTimeMinutesToday = operatingDay.endTime === "00:00" ? 24 * 60 : timeStringToMinutes(operatingDay.endTime);
        
        let currentTimeMinutesInDay = newDate.getHours() * 60 + newDate.getMinutes();

        if (currentTimeMinutesInDay < opStartTimeMinutesToday) {
          newDate.setHours(Math.floor(opStartTimeMinutesToday / 60), opStartTimeMinutesToday % 60, 0, 0);
          currentTimeMinutesInDay = opStartTimeMinutesToday;
        }

        if (currentTimeMinutesInDay >= opEndTimeMinutesToday) {
          newDate.setDate(newDate.getDate() + 1);
          newDate.setHours(0, 0, 0, 0);
          continue; 
        }

        const availableMinutesInSlot = opEndTimeMinutesToday - currentTimeMinutesInDay;
        const minutesToProcessThisSlot = Math.min(remainingMinutesToAdd, availableMinutesInSlot);

        newDate.setMinutes(newDate.getMinutes() + minutesToProcessThisSlot);
        remainingMinutesToAdd -= minutesToProcessThisSlot;

        if (remainingMinutesToAdd > 0 && minutesToProcessThisSlot === availableMinutesInSlot) {
            newDate.setHours(Math.floor(opEndTimeMinutesToday/60), opEndTimeMinutesToday % 60, 0, 0);
        }

      } else {
        newDate.setDate(newDate.getDate() + 1);
        newDate.setHours(0, 0, 0, 0);
      }
    }
     if (safetyBreak === 0) {
        console.error("addWorkingTime safety break triggered. Base:", baseDate, "Minutes:", minutesToAdd, "Line:", line.name);
        return new Date(8640000000000000); 
    }
    return newDate;
  }, []); 

  const calculateEffectiveWorkDuration = useCallback((startTime: Date, endTime: Date, line: ProductionLine): number => {
    if (endTime <= startTime) return 0;

    let totalEffectiveMinutes = 0;
    const currentDayIter = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
    const finalEndTime = new Date(endTime);

    while (currentDayIter < finalEndTime) {
        const dayOfWeek = currentDayIter.getDay();
        const operatingDay = line.operatingHours.find(oh => oh.dayOfWeek === dayOfWeek);

        if (operatingDay && operatingDay.isActive) {
            const opDayStartDateTime = new Date(currentDayIter);
            const [opStartH, opStartM] = operatingDay.startTime.split(':').map(Number);
            opDayStartDateTime.setHours(opStartH, opStartM, 0, 0);

            const opDayEndDateTime = new Date(currentDayIter);
            if (operatingDay.endTime === "00:00") {
                opDayEndDateTime.setDate(opDayEndDateTime.getDate() + 1);
                opDayEndDateTime.setHours(0, 0, 0, 0);
            } else {
                const [opEndH, opEndM] = operatingDay.endTime.split(':').map(Number);
                opDayEndDateTime.setHours(opEndH, opEndM, 0, 0);
            }
            
            const segmentStartForCalc = (startTime > opDayStartDateTime) ? startTime : opDayStartDateTime;
            const segmentEndForCalc = (finalEndTime < opDayEndDateTime) ? finalEndTime : opDayEndDateTime;
            
            const dayStartBoundary = new Date(currentDayIter);
            dayStartBoundary.setHours(0,0,0,0);
            const dayEndBoundary = new Date(currentDayIter);
            dayEndBoundary.setDate(currentDayIter.getDate() + 1);
            dayEndBoundary.setHours(0,0,0,0);

            const effectiveSegmentStart = segmentStartForCalc > dayStartBoundary ? segmentStartForCalc : dayStartBoundary;
            const effectiveSegmentEnd = segmentEndForCalc < dayEndBoundary ? segmentEndForCalc : dayEndBoundary;

            if (effectiveSegmentEnd > effectiveSegmentStart && effectiveSegmentStart >= opDayStartDateTime && effectiveSegmentEnd <= opDayEndDateTime) {
                 totalEffectiveMinutes += (effectiveSegmentEnd.getTime() - effectiveSegmentStart.getTime()) / (1000 * 60);
            }
        }
        currentDayIter.setDate(currentDayIter.getDate() + 1); 
    }
    return Math.max(0, Math.round(totalEffectiveMinutes));
  }, []);


  const resumeLineOp = useCallback(async (lineId: string): Promise<{ success: boolean; message?: string }> => {
    const lineToResume = productionLines.find(l => l.id === lineId);
    if (!lineToResume || !lineToResume.isPaused || !lineToResume.currentPauseStartTime || !user) {
        const msg = !lineToResume ? "Linha não encontrada." : (!lineToResume.isPaused ? "Linha não está pausada." : (!user ? "Usuário não autenticado." : "Dados da pausa atual incompletos."));
        handleError('resumeLine', new Error(msg));
        return { success: false, message: msg };
    }

    const pauseStartTimeObj = new Date(lineToResume.currentPauseStartTime);
    const pauseEndTimeObj = new Date();
    const wallClockPauseDurationMinutes = Math.round((pauseEndTimeObj.getTime() - pauseStartTimeObj.getTime()) / (1000 * 60));

    // 1. Log history and update line status
    const historyEntry: Omit<DbLinePauseHistoryEntry, 'id' | 'created_at'> = {
        line_id: lineId,
        paused_by_user_email: lineToResume.pausedByUserEmail || user.email || 'Não especificado',
        pause_start_time: pauseStartTimeObj.toISOString(),
        pause_end_time: pauseEndTimeObj.toISOString(),
        pause_reason: lineToResume.currentPauseReason,
        duration_minutes: wallClockPauseDurationMinutes,
    };
    const { data: historyData, error: historyError } = await supabase.from('line_pause_history').insert({ ...historyEntry, id: generateUUID() }).select().single();
    if (historyError) {
        handleError('resumeLine (history logging)', historyError, `Falha ao registrar histórico de pausa para "${lineToResume.name}".`);
        return { success: false, message: `Falha ao registrar histórico de pausa. Detalhe: ${historyError.message}` };
    }
     if (historyData) {
        setLinePauseHistory(prev => [ { id: historyData.id, lineId: historyData.line_id, pausedByUserEmail: historyData.paused_by_user_email, pauseStartTime: historyData.pause_start_time, pauseEndTime: historyData.pause_end_time, pauseReason: historyData.pause_reason, durationMinutes: historyData.duration_minutes, createdAt: historyData.created_at, }, ...prev ].sort((a,b) => new Date(b.pauseStartTime).getTime() - new Date(a.pauseStartTime).getTime()));
    }

    const updatePayload = { is_paused: false, current_pause_start_time: null, current_pause_reason: null, paused_by_user_email: null, };
    const { error: resumeError } = await supabase.from('production_lines').update(updatePayload).eq('id', lineId);
    if (resumeError) {
        handleError('resumeLine', resumeError, `Falha ao retomar linha "${lineToResume.name}". Detalhe: ${resumeError.message}`);
        return { success: false, message: `Falha ao retomar linha. Detalhe: ${resumeError.message}` };
    }

    // 2. Schedule Propagation Logic
    let propagationMessages: string[] = [];
    let lastValidEndTime = pauseEndTimeObj; // Earliest point a task can continue or start.
    const allSchedulesOnLine = [...schedules].filter(s => s.lineId === lineId).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const updatesToPerform: { scheduleId: string; updates: Partial<DbScheduledProductionRun> }[] = [];

    // Find the task that was interrupted, if any
    const interruptedSchedule = allSchedulesOnLine.find(s =>
        s.status === 'Em Progresso' &&
        new Date(s.startTime) < pauseStartTimeObj &&
        new Date(s.endTime) > pauseStartTimeObj
    );
    
    let firstScheduleToRepackIndex = -1;

    if (interruptedSchedule) {
        firstScheduleToRepackIndex = allSchedulesOnLine.findIndex(s => s.id === interruptedSchedule.id) + 1;
        const totalWorkRequiredMinutes = calculateEffectiveWorkDuration(new Date(interruptedSchedule.startTime), new Date(interruptedSchedule.endTime), lineToResume);
        const workDoneBeforePauseMinutes = calculateEffectiveWorkDuration(new Date(interruptedSchedule.startTime), pauseStartTimeObj, lineToResume);
        const workRemainingMinutes = Math.max(0, totalWorkRequiredMinutes - workDoneBeforePauseMinutes);

        // The task was interrupted. Its end time must be recalculated.
        // If workRemainingMinutes is 0, addWorkingTime will correctly find the next available slot after the pause ends.
        const newEndTime = addWorkingTime(pauseEndTimeObj, workRemainingMinutes, lineToResume);

        updatesToPerform.push({
            scheduleId: interruptedSchedule.id,
            updates: {
                end_time: newEndTime.toISOString(),
                // CRITICAL: Do NOT change the status. It's still 'Em Progresso'.
                interruption_pause_start_time: pauseStartTimeObj.toISOString(),
                interruption_pause_end_time: pauseEndTimeObj.toISOString(),
            }
        });
        
        lastValidEndTime = newEndTime;
        propagationMessages.push(`Agendamento "${getProductByIdOp(interruptedSchedule.productId)?.name}" continuado após pausa. Novo fim: ${newEndTime.toLocaleString('pt-BR')}.`);

    } else {
        // No task was 'In Progress'. Find the first pending task affected by the pause.
        firstScheduleToRepackIndex = allSchedulesOnLine.findIndex(s => new Date(s.startTime) >= pauseStartTimeObj);
    }

    // "Re-pack" all subsequent schedules
    if (firstScheduleToRepackIndex !== -1) {
        for (let i = firstScheduleToRepackIndex; i < allSchedulesOnLine.length; i++) {
            const scheduleToRepack = allSchedulesOnLine[i];
            
            // Only repack pending tasks. Others are considered fixed.
            if (scheduleToRepack.status !== 'Pendente') {
                const fixedEndTime = new Date(scheduleToRepack.endTime);
                if (fixedEndTime > lastValidEndTime) {
                    lastValidEndTime = fixedEndTime;
                }
                continue;
            }

            const originalDuration = calculateEffectiveWorkDuration(new Date(scheduleToRepack.startTime), new Date(scheduleToRepack.endTime), lineToResume);
            if (originalDuration <= 0) continue;

            const newStartTime = addWorkingTime(lastValidEndTime, 0, lineToResume);
            const newEndTime = addWorkingTime(newStartTime, originalDuration, lineToResume);

            updatesToPerform.push({
                scheduleId: scheduleToRepack.id,
                updates: {
                    start_time: newStartTime.toISOString(),
                    end_time: newEndTime.toISOString(),
                    interruption_pause_start_time: null,
                    interruption_pause_end_time: null,
                }
            });
            lastValidEndTime = newEndTime; // Update anchor for the next task
            propagationMessages.push(`Agendamento pendente "${getProductByIdOp(scheduleToRepack.productId)?.name}" reagendado.`);
        }
    }
    
    // 3. Perform all updates in the database
    for (const { scheduleId, updates } of updatesToPerform) {
        const { error: scheduleUpdateError } = await supabase.from('scheduled_production_runs').update(updates).eq('id', scheduleId);
        if (scheduleUpdateError) {
            propagationMessages.push(`Erro ao atualizar agendamento ID ${scheduleId}: ${scheduleUpdateError.message}`);
        }
    }
    
    // 4. Refetch data and provide feedback
    await fetchInitialData();
    const effectiveLostOperatingTimeDuringPause = calculateEffectiveWorkDuration(pauseStartTimeObj, pauseEndTimeObj, lineToResume);
    let finalMessage = `Linha "${lineToResume.name}" retomada. Tempo de operação perdido: ${effectiveLostOperatingTimeDuringPause} min.`;
    if (propagationMessages.length > 0) {
        finalMessage += ` Resumo das atualizações: ${propagationMessages.slice(0, 2).join('; ')}${propagationMessages.length > 2 ? '...' : ''}`;
    }
    return { success: true, message: finalMessage };
}, [productionLines, user, handleError, schedules, getProductByIdOp, fetchInitialData, addWorkingTime, calculateEffectiveWorkDuration]);


  const optimizeDaySchedulesOp = useCallback(async (dateToOptimize: Date, targetLineId?: string): Promise<{ optimizedCount: number; unoptimizedCount: number; details: string[] }> => {
    setIsLoading(true);
    let optimizedCount = 0;
    let unoptimizedCount = 0;
    let details: string[] = [];

    const startOfDay = new Date(dateToOptimize);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateToOptimize);
    endOfDay.setHours(23, 59, 59, 999);

    const schedulesForDay = schedules.filter(s => {
        const sDate = new Date(s.startTime);
        return sDate >= startOfDay && sDate <= endOfDay;
    });

    const linesInUseToday = [...new Set(schedulesForDay.map(s => s.lineId))]
        .map(id => getProductionLineByIdOp(id))
        .filter((l): l is ProductionLine => l !== undefined);

    const linesToOptimize = targetLineId
        ? linesInUseToday.filter(line => line.id === targetLineId)
        : linesInUseToday;
    
    if (targetLineId && linesToOptimize.length === 0) {
        details.push(`A linha selecionada não tem agendamentos para otimizar hoje.`);
    }

    for (const line of linesToOptimize) {
        if (line.isPaused) {
            details.push(`Linha ${line.name} está pausada e foi ignorada na otimização.`);
            continue;
        }

        const lineSchedules = schedulesForDay
            .filter(s => s.lineId === line.id)
            .sort((a, b) => {
                const productA = getProductByIdOp(a.productId);
                const productB = getProductByIdOp(b.productId);
                if (productA?.classification === 'Top Seller' && productB?.classification !== 'Top Seller') return -1;
                if (productA?.classification !== 'Top Seller' && productB?.classification === 'Top Seller') return 1;
                return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
            });

        const now = new Date();
        const isOptimizingToday = startOfDay.toDateString() === now.toDateString();
        
        let lastEndTimeOnLine = isOptimizingToday ? new Date(now) : new Date(startOfDay);

        const fixedSchedulesOnLine = lineSchedules.filter(s => {
            const product = getProductByIdOp(s.productId);
            return product?.classification === 'Top Seller' || s.status !== 'Pendente';
        });

        for (const schedule of lineSchedules) {
            const product = getProductByIdOp(schedule.productId);

            if (!product) {
                details.push(`Produto ID ${schedule.productId} não encontrado para o agendamento ${schedule.id}.`);
                unoptimizedCount++;
                continue;
            }

            if (fixedSchedulesOnLine.some(fs => fs.id === schedule.id)) {
                const scheduleEndTime = new Date(schedule.endTime);
                if (scheduleEndTime > lastEndTimeOnLine) {
                    lastEndTimeOnLine = scheduleEndTime;
                }
                continue;
            }

            const originalEffectiveDurationMinutes = calculateEffectiveWorkDuration(new Date(schedule.startTime), new Date(schedule.endTime), line);
            if (originalEffectiveDurationMinutes <= 0) {
                const scheduleEndTime = new Date(schedule.endTime);
                if (scheduleEndTime > lastEndTimeOnLine) lastEndTimeOnLine = scheduleEndTime;
                continue;
            }

            let newStartTime = addWorkingTime(new Date(lastEndTimeOnLine), 0, line);
            
            if (isOptimizingToday && newStartTime < now) {
                newStartTime = addWorkingTime(new Date(now), 0, line);
            }

            const newEndTime = addWorkingTime(new Date(newStartTime), originalEffectiveDurationMinutes, line);

            let conflictWithFixed = false;
            for (const fixedSchedule of fixedSchedulesOnLine) {
                const fixedStart = new Date(fixedSchedule.startTime);
                const fixedEnd = new Date(fixedSchedule.endTime);
                if (newStartTime < fixedEnd && fixedStart < newEndTime) {
                    conflictWithFixed = true;
                    const fixedProduct = getProductByIdOp(fixedSchedule.productId);
                    details.push(`Conflito ao otimizar ${schedule.id} (${product.name}): colide com o agendamento fixo de ${fixedProduct?.name || 'N/D'} em ${line.name}.`);
                    break;
                }
            }

            if (!conflictWithFixed) {
                if (newStartTime.toISOString() !== schedule.startTime || newEndTime.toISOString() !== schedule.endTime) {
                    const updateResult = await updateScheduleOp({ ...schedule, startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString() });
                    if (updateResult) {
                        optimizedCount++;
                        details.push(`Agendamento ${schedule.id} (${product.name}) otimizado para ${newStartTime.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} em ${line.name}.`);
                    } else {
                        unoptimizedCount++;
                        details.push(`Falha ao atualizar agendamento ${schedule.id} (${product.name}) durante otimização.`);
                        const originalEndTime = new Date(schedule.endTime);
                        if (originalEndTime > lastEndTimeOnLine) {
                            lastEndTimeOnLine = originalEndTime;
                        }
                        continue;
                    }
                }
                lastEndTimeOnLine = newEndTime;
            } else {
                unoptimizedCount++;
                const originalEndTime = new Date(schedule.endTime);
                if (originalEndTime > lastEndTimeOnLine) {
                    lastEndTimeOnLine = originalEndTime;
                }
            }
        }
    }

    setIsLoading(false);
    await fetchInitialData();
    return { optimizedCount, unoptimizedCount, details };
}, [schedules, getProductionLineByIdOp, getProductByIdOp, updateScheduleOp, fetchInitialData, addWorkingTime, calculateEffectiveWorkDuration]);


  const finishScheduleNowOp = useCallback(async (scheduleId: string): Promise<{ success: boolean; message?: string }> => {
    const scheduleToFinish = schedules.find(s => s.id === scheduleId);
    if (!scheduleToFinish) {
        const msg = `Agendamento com ID ${scheduleId} não encontrado.`;
        handleError('finishScheduleNow', new Error(msg));
        return { success: false, message: msg };
    }

    if (scheduleToFinish.status !== 'Em Progresso') {
        const msg = `O agendamento não está 'Em Progresso'. Status atual: ${scheduleToFinish.status}.`;
        console.warn(`Attempted to finish a schedule that is not 'In Progress'. ID: ${scheduleId}, Status: ${scheduleToFinish.status}`);
        return { success: false, message: msg };
    }

    const updatedSchedule: ScheduledProductionRun = {
        ...scheduleToFinish,
        status: 'Concluído',
        endTime: new Date().toISOString(),
    };

    const result = await updateScheduleOp(updatedSchedule, true); // shouldRefetch = true
    if (result) {
        const product = getProductByIdOp(result.productId);
        const msg = `Produção de "${product?.name || 'produto desconhecido'}" finalizada com sucesso. A linha está livre.`;
        return { success: true, message: msg };
    } else {
        const msg = `Falha ao finalizar a produção.`;
        return { success: false, message: msg };
    }
  }, [schedules, handleError, updateScheduleOp, getProductByIdOp]);


  // Effect for automatic schedule status updates
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const updates: Promise<any>[] = [];
      schedules.forEach(schedule => {
        const line = getProductionLineByIdOp(schedule.lineId);
        const startTime = new Date(schedule.startTime);
        const endTime = new Date(schedule.endTime);

        // Only process schedules on lines that are NOT paused
        if (line && !line.isPaused) {
            // Rule 1: 'Pendente' ==> 'Em Progresso'
            if (schedule.status === 'Pendente' && now >= startTime && now < endTime) {
                updates.push(updateScheduleOp({ ...schedule, status: 'Em Progresso' }));
            }
            // Rule 2: 'Em Progresso' ==> 'Concluído'
            else if (schedule.status === 'Em Progresso' && now >= endTime) {
                updates.push(updateScheduleOp({ ...schedule, status: 'Concluído' }));
            }
            // Rule 3: 'Pendente' ==> 'Cancelado' (Missed schedule)
            else if (schedule.status === 'Pendente' && now >= endTime) {
                const newNote = `${schedule.notes || ''} (Cancelado automaticamente: horário de produção perdido)`.trim();
                updates.push(updateScheduleOp({ ...schedule, status: 'Cancelado', notes: newNote }));
            }
        }
      });
      
      if (updates.length > 0) {
        // console.log(`AppDataContext: Auto-updating status for ${updates.length} schedules.`);
        Promise.all(updates).catch(error => {
            console.error("Error during automatic schedule status update:", error);
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(timer);
  }, [schedules, updateScheduleOp, getProductionLineByIdOp]); 

  return (
    <AppDataContext.Provider value={{
      equipment, addEquipment: addEquipmentOp, updateEquipment: updateEquipmentOp, deleteEquipment: deleteEquipmentOp, getEquipmentById: getEquipmentByIdOp,
      products, addProduct: addProductOp, updateProduct: updateProductOp, deleteProduct: deleteProductOp, getProductById: getProductByIdOp,
      productionLines, addProductionLine: addProductionLineOp, updateProductionLine: updateProductionLineOp, updateProductionLinesOrder: updateProductionLinesOrderOp, deleteProductionLine: deleteProductionLineOp, getProductionLineById: getProductionLineByIdOp,
      schedules, addSchedule: addScheduleOp, updateSchedule: updateScheduleOp, deleteSchedule: deleteScheduleOp, getScheduleById: getScheduleByIdOp,
      finishScheduleNow: finishScheduleNowOp,
      pauseLine: pauseLineOp,
      resumeLine: resumeLineOp,
      addWorkingTime,
      calculateEffectiveWorkDuration,
      linePauseHistory,
      optimizeDaySchedules: optimizeDaySchedulesOp,
      isLoading,
      error: errorState,
      fetchInitialData,
      hasDisplayOrderFeature,
    }}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = (): AppDataContextType => {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
