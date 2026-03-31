'use client';
import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, useEffect, ChangeEvent, FormEvent, useRef, KeyboardEvent } from 'react';
import { Edit, Trash2, Search, X, CheckCircle, AlertCircle, Eye, Calendar, Clock, Save } from 'lucide-react';

// Interface de empleados
type Employee = {
  EmployeeID: number;
  BasePersonnelID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string;
  Position: string;
  ContractStartDate: string;
  YearsOfSeniority: number;
  DaysOfVacations: number;
};

// Interface para vacaciones
type VacationRecord = {
  VacationID: number;
  EmployeeID: number;
  Days: number;
  StampedDays: number;
  StartDate: string;
  EndDate: string;
  Observations: string;
  YearsOfSeniority: number;
  DaysOfVacations: number;
};

// Interface para búsqueda de empleados
interface EmployeeSearchResult {
  EmployeeID: number;
  FirstName: string;
  LastName: string;
  MiddleName: string | null;
  Position: string;
  tipo: 'BASE' | 'PROJECT';
  Area?: string;
  NameProject?: string;
}

// Función para formatear fecha
const formatDate = (dateString: string): string => {
  try {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// Función para formatear fecha para input date
const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();
  // Referencias
  const employeeIdInputRef = useRef<HTMLInputElement>(null);

  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para el formulario
  const [formData, setFormData] = useState({
    EmployeeID: '',
    Days: '',
    StartDate: '',
    Observations: ''
  });

  // Estados para fecha de término calculada
  const [calculatedEndDate, setCalculatedEndDate] = useState<string>('');
  const [selectedEmployeeSeniority, setSelectedEmployeeSeniority] = useState<{
    years: number;
    days: number;
  } | null>(null);

  // Estados para operaciones
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id: number | null }>({ show: false, id: null });
  
  // Estados para búsqueda de empleados por ID
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [searchingEmployee, setSearchingEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<EmployeeSearchResult | null>(null);
  const [employeeNotFound, setEmployeeNotFound] = useState(false);

  // Estados para vacaciones
  const [showVacationsModal, setShowVacationsModal] = useState(false);
  const [selectedVacationsEmployee, setSelectedVacationsEmployee] = useState<Employee | null>(null);
  const [vacationRecords, setVacationRecords] = useState<VacationRecord[]>([]);
  const [loadingVacations, setLoadingVacations] = useState(false);
  const [editingObservation, setEditingObservation] = useState<number | null>(null);
  const [editObservationValue, setEditObservationValue] = useState('');
  const [updatingObservation, setUpdatingObservation] = useState(false);

  // Estados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

  // Calcular fecha de término cuando cambian los días o la fecha de inicio
  useEffect(() => {
    if (formData.Days && parseInt(formData.Days) > 0 && formData.StartDate) {
      const startDate = new Date(formData.StartDate);
      // Validar que la fecha de inicio sea válida
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(formData.Days));
        setCalculatedEndDate(formatDate(endDate.toISOString()));
      } else {
        setCalculatedEndDate('');
      }
    } else {
      setCalculatedEndDate('');
    }
  }, [formData.Days, formData.StartDate]);

  // Cargar empleados al montar el componente
  useEffect(() => {
    if (user) {
      fetchEmployees();
    }
  }, [user]);

  // Filtrar empleados cuando cambia el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(employee =>
        employee.FirstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.LastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.MiddleName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.Position?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmployees(filtered);
    }
  }, [searchTerm, employees]);

  // Mostrar loading mientras se verifica la sesión
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a6ea5] mx-auto"></div>
          <p className="mt-4 text-gray-700 font-medium">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario (sesión inválida), no renderizar nada
  if (!user) {
    return null;
  }

  // Función para normalizar texto a mayúsculas
  const normalizarMayusculas = (texto: string): string => {
    return texto.toUpperCase();
  };

  // Función para buscar empleado por ID al presionar Enter
  const handleEmployeeIdKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const id = employeeIdInput.trim();
      
      if (!id) {
        setError('POR FAVOR INGRESE UN ID DE EMPLEADO');
        return;
      }

      await searchEmployeeById(id);
    }
  };

  // Función para buscar empleado por ID
  const searchEmployeeById = async (id: string) => {
    try {
      setSearchingEmployee(true);
      setEmployeeNotFound(false);
      setError('');

      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeemovements/search?term=${encodeURIComponent(id)}`);
      
      if (response.ok) {
        const data = await response.json();
        const employee = data.employees?.find((emp: EmployeeSearchResult) => 
          emp.EmployeeID.toString() === id
        );
        
        if (employee) {
          setSelectedEmployee(employee);
          setSelectedEmployeeData(employee);
          setFormData(prev => ({
            ...prev,
            EmployeeID: employee.EmployeeID.toString()
          }));
          setEmployeeNotFound(false);
          
          // Obtener la antigüedad del empleado seleccionado
          await fetchEmployeeSeniority(employee.EmployeeID);
        } else {
          setSelectedEmployee(null);
          setSelectedEmployeeData(null);
          setFormData(prev => ({
            ...prev,
            EmployeeID: ''
          }));
          setEmployeeNotFound(true);
          setError('NO SE ENCONTRÓ UN EMPLEADO CON ESE ID');
        }
      } else {
        setError('ERROR AL BUSCAR EL EMPLEADO');
      }
    } catch (error) {
      console.error('Error al buscar empleado:', error);
      setError('ERROR DE CONEXIÓN AL BUSCAR EMPLEADO');
    } finally {
      setSearchingEmployee(false);
    }
  };

  // Función para obtener la antigüedad del empleado
  const fetchEmployeeSeniority = async (employeeId: number) => {
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=get&employeeId=${employeeId}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        // No es necesario hacer nada aquí, la antigüedad ya viene en la lista de empleados
        const employeeData = employees.find(emp => emp.EmployeeID === employeeId);
        if (employeeData) {
          setSelectedEmployeeSeniority({
            years: employeeData.YearsOfSeniority,
            days: employeeData.DaysOfVacations
          });
        }
      }
    } catch (error) {
      console.error('Error fetching employee seniority:', error);
    }
  };

  // Función para limpiar la búsqueda de empleados
  const clearEmployeeSearch = () => {
    setEmployeeIdInput('');
    setSelectedEmployee(null);
    setSelectedEmployeeData(null);
    setSelectedEmployeeSeniority(null);
    setFormData(prev => ({
      ...prev,
      EmployeeID: ''
    }));
    setEmployeeNotFound(false);
    setError('');
    if (employeeIdInputRef.current) {
      employeeIdInputRef.current.focus();
    }
  };

  // Función para cargar empleados
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/administrative-personnel-dashboard/employee-management/employeevacations');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
        setFilteredEmployees(data);
      } else {
        throw new Error('ERROR AL CARGAR EMPLEADOS');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setErrorMessage('ERROR AL CARGAR LOS EMPLEADOS. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener vacaciones de un empleado
  const fetchVacationRecords = async (employeeId: number) => {
    setLoadingVacations(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=get&employeeId=${employeeId}`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        const data = await response.json();
        setVacationRecords(data);
      } else {
        throw new Error('ERROR AL CARGAR PERÍODOS DE VACACIONES');
      }
    } catch (error) {
      console.error('Error fetching vacation records:', error);
      setErrorMessage('ERROR AL CARGAR LOS PERÍODOS DE VACACIONES DEL EMPLEADO');
    } finally {
      setLoadingVacations(false);
    }
  };

  // Función para actualizar observaciones
  const handleUpdateObservation = async (vacationId: number) => {
    if (!editObservationValue.trim()) {
      setErrorMessage('LAS OBSERVACIONES NO PUEDEN ESTAR VACÍAS');
      return;
    }

    setUpdatingObservation(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?action=update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vacationId,
          observations: editObservationValue
        })
      });

      if (response.ok) {
        setSuccessMessage('OBSERVACIONES ACTUALIZADAS EXITOSAMENTE');
        // Actualizar la lista local
        setVacationRecords(prev =>
          prev.map(record =>
            record.VacationID === vacationId
              ? { ...record, Observations: editObservationValue }
              : record
          )
        );
        setEditingObservation(null);
        setEditObservationValue('');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('ERROR AL ACTUALIZAR OBSERVACIONES');
      }
    } catch (error) {
      console.error('Error updating observation:', error);
      setErrorMessage('ERROR AL ACTUALIZAR LAS OBSERVACIONES');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setUpdatingObservation(false);
    }
  };

  // Iniciar edición de observaciones
  const startEditObservation = (record: VacationRecord) => {
    setEditingObservation(record.VacationID);
    setEditObservationValue(record.Observations || '');
  };

  // Cancelar edición de observaciones
  const cancelEditObservation = () => {
    setEditingObservation(null);
    setEditObservationValue('');
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: normalizarMayusculas(value)
    }));
  };

  // Manejar cambios en la fecha de inicio
  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      StartDate: value
    }));
  };

  // Manejar envío del formulario (crear)
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    
    // Validar que haya un empleado seleccionado
    if (!selectedEmployeeData) {
      setErrorMessage('POR FAVOR, BUSQUE Y SELECCIONE UN EMPLEADO');
      return;
    }

    // Validar campos requeridos
    if (!formData.Days || !formData.StartDate) {
      setErrorMessage('POR FAVOR, COMPLETE TODOS LOS CAMPOS REQUERIDOS');
      return;
    }

    // Validar que los días sean positivos
    const daysToTake = parseFloat(formData.Days);
    if (daysToTake <= 0) {
      setErrorMessage('LOS DÍAS A TOMAR DEBEN SER MAYORES A CERO');
      return;
    }

    // Validar que los días no excedan los disponibles
    if (selectedEmployeeSeniority && daysToTake > selectedEmployeeSeniority.days) {
      setErrorMessage(`LOS DÍAS SOLICITADOS (${formData.Days}) EXCEDEN LOS DÍAS DISPONIBLES (${selectedEmployeeSeniority.days})`);
      return;
    }

    setLoading(true);
    try {
      const url = '/api/administrative-personnel-dashboard/employee-management/employeevacations';
      const method = 'POST';

      // Preparar datos en mayúsculas
      const datosEnviar = {
        EmployeeID: selectedEmployeeData.EmployeeID,
        Days: formData.Days.trim(),
        StartDate: formData.StartDate,
        Observations: formData.Observations.trim()
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datosEnviar),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccessMessage('¡PERÍODO DE VACACIONES CREADO EXITOSAMENTE!');
        
        // Recargar empleados
        fetchEmployees();
        
        // Limpiar formulario y cerrar modal
        resetForm();
        setShowModal(false);
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'ERROR AL PROCESAR LA SOLICITUD');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setErrorMessage(error.message || 'ERROR AL PROCESAR LA SOLICITUD. POR FAVOR, INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  // Ver vacaciones del empleado
  const handleViewVacations = async (employee: Employee) => {
    setSelectedVacationsEmployee(employee);
    setShowVacationsModal(true);
    await fetchVacationRecords(employee.EmployeeID);
  };

  // Eliminar período de vacaciones
  const handleDeleteVacation = async (vacationId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/administrative-personnel-dashboard/employee-management/employeevacations?id=${vacationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setSuccessMessage('PERÍODO DE VACACIONES ELIMINADO EXITOSAMENTE');
        // Actualizar lista local
        setVacationRecords(prev => prev.filter(record => record.VacationID !== vacationId));
        // Recargar empleados para actualizar la tabla principal
        fetchEmployees();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error('ERROR AL ELIMINAR EL PERÍODO');
      }
    } catch (error) {
      console.error('Error deleting vacation:', error);
      setErrorMessage('ERROR AL ELIMINAR EL PERÍODO DE VACACIONES');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoading(false);
      setConfirmDelete({ show: false, id: null });
    }
  };

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      EmployeeID: '',
      Days: '',
      StartDate: '',
      Observations: ''
    });
    setCalculatedEndDate('');
    setSelectedEmployeeSeniority(null);
    setIsEditing(false);
    setEditingId(null);
    setEmployeeIdInput('');
    setSelectedEmployee(null);
    setSelectedEmployeeData(null);
    setEmployeeNotFound(false);

    setTimeout(() => {
      if (employeeIdInputRef.current) {
        employeeIdInputRef.current.focus();
      }
    }, 100);
  };

  // Abrir modal para nuevo período
  const openCreateModal = () => {
    resetForm();
    setModalMode('create');
    setShowModal(true);
  };

  // Cerrar modal
  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  // Cerrar modal de vacaciones
  const closeVacationsModal = () => {
    setShowVacationsModal(false);
    setSelectedVacationsEmployee(null);
    setVacationRecords([]);
    setEditingObservation(null);
    setEditObservationValue('');
  };

  const getUniqueKey = (employee: Employee, index: number) => {
    return `${employee.EmployeeID}-${index}`;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER - Fixed */}
      <AppHeader 
        title="PANEL ADMINISTRATIVO"
      />

      {/* MODAL PARA CREAR NUEVO PERÍODO */}
      {showModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                  NUEVO PERÍODO DE VACACIONES
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  Complete el formulario para registrar un nuevo período de vacaciones del empleado.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="space-y-6">
                  {/* Búsqueda por ID del empleado */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                      ID DEL EMPLEADO 
                    </h3>
                    
                    <div className="mb-4">
                      <div className="relative">
                        <input
                          ref={employeeIdInputRef}
                          type="text"
                          value={employeeIdInput}
                          onChange={(e) => {
                            setEmployeeIdInput(normalizarMayusculas(e.target.value));
                            if (employeeNotFound) setEmployeeNotFound(false);
                          }}
                          onKeyDown={handleEmployeeIdKeyDown}
                          placeholder="Ingrese el ID del empleado"
                          className={`w-full px-3 py-2.5 text-sm bg-white border rounded focus:outline-none focus:border-[#3a6ea5] font-medium ${
                            employeeNotFound ? 'border-red-500' : 'border-gray-400'
                          }`}
                          disabled={selectedEmployee !== null}
                        />
                        {!selectedEmployee && employeeIdInput && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                            ENTER PARA BUSCAR
                          </div>
                        )}
                        {selectedEmployee && (
                          <button
                            onClick={clearEmployeeSearch}
                            type="button"
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            title="Limpiar búsqueda"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      {searchingEmployee && (
                        <div className="mt-2 text-sm text-gray-600 flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#3a6ea5] mr-2"></div>
                          BUSCANDO EMPLEADO...
                        </div>
                      )}
                      {employeeNotFound && (
                        <p className="mt-2 text-sm text-red-600">
                          No se encontró un empleado con ese ID
                        </p>
                      )}
                    </div>

                    {/* Datos del empleado seleccionado */}
                    {selectedEmployeeData && (
                      <div className="space-y-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                            INFORMACIÓN DEL EMPLEADO
                          </h3>
                        
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">Nombre completo</span>
                              <span className="text-sm text-gray-900">
                                {`${selectedEmployeeData.FirstName} ${selectedEmployeeData.LastName} ${selectedEmployeeData.MiddleName || ''}`.trim()}
                              </span>
                            </div>

                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">ID del empleado</span>
                              <span className="text-sm text-gray-900">{selectedEmployeeData.EmployeeID}</span>
                            </div>

                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">Tipo</span>
                              <span className="text-sm text-gray-900">{selectedEmployeeData.tipo}</span>
                            </div>

                            <div>
                              <span className="block text-xs font-bold text-gray-500 uppercase">Puesto</span>
                              <span className="text-sm text-gray-900">{selectedEmployeeData.Position || 'N/A'}</span>
                            </div>

                            {selectedEmployeeData.tipo === 'BASE' ? (
                              <div>
                                <span className="block text-xs font-bold text-gray-500 uppercase">Área</span>
                                <span className="text-sm text-gray-900">{selectedEmployeeData.Area || 'N/A'}</span>
                              </div>
                            ) : (
                              <div>
                                <span className="block text-xs font-bold text-gray-500 uppercase">Proyecto</span>
                                <span className="text-sm text-gray-900">{selectedEmployeeData.NameProject || 'N/A'}</span>
                              </div>
                            )}

                             {selectedEmployeeSeniority && (
                              <div>
                                <div>
                                  <span className="block text-xs font-bold text-gray-500 uppercase">Años de antigüedad</span>
                                  <span className="text-sm text-gray-900">{selectedEmployeeSeniority.years} años</span>
                                </div>
                                </div>
                             )}

                             {selectedEmployeeSeniority && (
                              <div>
                                <div>
                                  <span className="block text-xs font-bold text-gray-500 uppercase">Días de vacaciones disponibles</span>
                                  <span className="text-sm text-gray-900">{selectedEmployeeSeniority.days} días</span>
                                </div>
                                </div>
                             )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Datos de antigüedad */}
                   
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase border-b border-gray-200 pb-2">
                      DATOS DEL PERÍODO DE VACACIONES
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE INICIO *
                        </label>
                        <input
                          type="date"
                          name="StartDate"
                          value={formData.StartDate}
                          onChange={handleStartDateChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          DÍAS A TOMAR *
                        </label>
                        <input
                          type="number"
                          name="Days"
                          value={formData.Days}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese los días a tomar"
                          required
                          step="0.5"
                          min="0.5"
                          max={selectedEmployeeSeniority?.days || 32}
                        />
                        {selectedEmployeeSeniority && parseFloat(formData.Days) > selectedEmployeeSeniority.days && (
                          <p className="mt-1 text-xs text-red-600">
                            Los días solicitados exceden los días disponibles ({selectedEmployeeSeniority.days} días)
                          </p>
                        )}
                      </div>

                      {/* Fecha de término calculada */}
                      {calculatedEndDate && (
                        <div className="md:col-span-2 bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <label className="block text-xs font-bold text-blue-700 mb-2 uppercase flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            FECHA DE TÉRMINO (CALCULADA AUTOMÁTICAMENTE)
                          </label>
                          <p className="text-sm font-semibold text-blue-900">{calculatedEndDate}</p>
                          <p className="text-xs text-blue-600 mt-1">
                            La fecha de término se calcula automáticamente sumando los días a la fecha de inicio seleccionada
                          </p>
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          OBSERVACIONES
                        </label>
                        <textarea
                          name="Observations"
                          value={formData.Observations}
                          onChange={handleInputChange}
                          rows={3}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Observaciones (opcional)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      GUARDANDO...
                    </>
                  ) : (
                    'CREAR PERÍODO'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA VER VACACIONES */}
      {showVacationsModal && selectedVacationsEmployee && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                  <Calendar className="h-5 w-5 text-[#3a6ea5] mr-2" />
                  PERÍODOS DE VACACIONES
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {`${selectedVacationsEmployee.FirstName} ${selectedVacationsEmployee.LastName} ${selectedVacationsEmployee.MiddleName || ''}`.trim()} | ID: {selectedVacationsEmployee.EmployeeID} | Puesto: {selectedVacationsEmployee.Position}
                </p>
                <p className="text-gray-600 mt-1 text-sm">
                  Antigüedad: {selectedVacationsEmployee.YearsOfSeniority} años | Días disponibles: {selectedVacationsEmployee.DaysOfVacations}
                </p>
              </div>
              <button
                onClick={closeVacationsModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6">
              {loadingVacations ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5]"></div>
                  <p className="ml-3 text-gray-600">Cargando registros...</p>
                </div>
              ) : vacationRecords.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No hay períodos de vacaciones registrados para este empleado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA INICIO</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA FIN</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DÍAS</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DÍAS COMPUTADOS</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">OBSERVACIONES</th>
                        <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vacationRecords.map((record) => (
                        <tr key={record.VacationID} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                          <td className="py-3 px-4 text-sm text-gray-800">{record.VacationID}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(record.StartDate)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(record.EndDate)}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">{record.Days}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{record.StampedDays}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-xs">
                            {editingObservation === record.VacationID ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  value={editObservationValue}
                                  onChange={(e) => setEditObservationValue(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-[#3a6ea5]"
                                  rows={2}
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdateObservation(record.VacationID)}
                                    disabled={updatingObservation}
                                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 flex items-center gap-1"
                                  >
                                    <Save className="h-3 w-3" />
                                    GUARDAR
                                  </button>
                                  <button
                                    onClick={cancelEditObservation}
                                    className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                                  >
                                    CANCELAR
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-start gap-2">
                                <span className="break-words flex-1">{record.Observations || '-'}</span>
                                <button
                                  onClick={() => startEditObservation(record)}
                                  className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                  title="Editar observaciones"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                           </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setConfirmDelete({ show: true, id: record.VacationID })}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="p-6 pt-4 border-t border-gray-300 bg-gray-50 flex justify-end">
              <button
                onClick={closeVacationsModal}
                className="bg-[#3a6ea5] text-white font-bold py-2.5 px-6 rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR */}
      {confirmDelete.show && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/70"
          style={{ margin: 0, top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative z-[10000]">
            <div className="p-6 pb-4 border-b border-gray-300">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                CONFIRMAR ELIMINACIÓN
              </h2>
              <p className="text-sm text-gray-600 mt-2 leading-5">
                ¿Está seguro que desea eliminar este período de vacaciones? Esta acción no se puede deshacer.
              </p>
            </div>
            
            <div className="p-6 pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete({ show: false, id: null })}
                className="bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center whitespace-nowrap"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={() => confirmDelete.id && handleDeleteVacation(confirmDelete.id)}
                disabled={loading}
                className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center whitespace-nowrap"                
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ELIMINANDO...
                  </>
                ) : (
                  'ELIMINAR'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      <main className="pt-[72px] pb-[80px] min-h-screen bg-gray-100">
        <div className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
                <h1 className="text-xl font-bold text-white tracking-tight">VACACIONES</h1>
                <p className="text-sm text-gray-200 mt-1">
                  Gestione las vacaciones de los empleados.
                </p>
              </div>
            </div>

            {/* MENSAJES DE ÉXITO/ERROR */}
            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {successMessage}
                  </p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <p className="text-sm font-medium text-gray-600 leading-5">
                    {errorMessage}
                  </p>
                </div>
              </div>
            )}

            {/* BARRA DE ACCIONES Y BÚSQUEDA */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o puesto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
              
              <button
                onClick={openCreateModal}
                className="px-6 py-2.5 bg-[#3a6ea5] text-white font-bold rounded-lg hover:bg-[#2d5592] transition-colors flex items-center justify-center whitespace-nowrap"
              >
                NUEVO PERÍODO
              </button>
            </div>

            {/* TABLA DE EMPLEADOS */}
            <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">ID</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">NOMBRE DEL EMPLEADO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">PUESTO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">FECHA DE INGRESO</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">AÑOS DE ANTIGÜEDAD</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300">DÍAS DE VACACIONES</th>
                      <th className="py-3 px-4 text-left text-sm font-bold text-gray-700 uppercase border-b border-gray-300 text-center">ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3a6ea5] mb-2"></div>
                            <p className="text-gray-600">Cargando períodos de vacaciones...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <AlertCircle className="h-8 w-8 text-gray-400 mb-3" />
                            <p className="text-sm font-medium text-gray-600 mt-2 leading-5">
                              {searchTerm ? 'No se encontraron empleados que coincidan con la búsqueda' : 'No hay empleados registrados'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((employee, index) => (
                        <tr key={getUniqueKey(employee, index)} className="hover:bg-gray-50 transition-colors border-b border-gray-300">
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">{employee.EmployeeID}</td>
                          <td className="py-3 px-4 text-sm text-gray-800 uppercase">{`${employee.FirstName} ${employee.LastName} ${employee.MiddleName || ''}`.trim()}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 uppercase max-w-xs truncate">{employee.Position}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(employee.ContractStartDate)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.YearsOfSeniority}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{employee.DaysOfVacations}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleViewVacations(employee)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                title="Ver períodos de vacaciones"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER - Fixed */}
      <Footer />

      {/* Agregar estilos para animaciones y layout */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes spin {
        from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        
        body {
          padding-top: 0;
          padding-bottom: 0;
          margin: 0;
          overflow-x: hidden;
        }
        
        .fixed.inset-0.z-\\[9999\\] {
          z-index: 9999 !important;
        }
        
        header, footer {
          z-index: 50 !important;
        }
        
        body.modal-open {
          overflow: hidden;
        }
        
        textarea {
          resize: none;
        }
      `}</style>
    </div>
  );
}     