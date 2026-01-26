'use client';
import AppHeader from '@/components/header/2/2.1';
import Footer from '@/components/footer';
import { useSessionManager } from '@/hooks/useSessionManager/2';
import { useInactivityManager } from '@/hooks/useInactivityManager';
import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { User, Calendar, CheckCircle, X } from 'lucide-react';

// Definir el tipo para el formulario
type FormData = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nss: string;
  curp: string;
  rfc: string;
  fechaNacimiento: string;
  genero: string;
  nacionalidad: string;
  estadoCivil: string;
  telefono: string;
  email: string;
  puesto: string;
  departamento: string;
  fechaIngreso: string;
  salario: string;
  horarioLaboral: string;
  tipoContrato: string;
  fechaInicioContrato: string;
  fechaFinContrato: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  municipio: string;
  estado: string;
  codigoPostal: string;
  nci: string;
  umf: string;
  salaryIMSS: string;
};

// Tipo para beneficiarios
type Beneficiario = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  parentesco: string;
  porcentaje: string;
};

// Mapa de nombres de campos para mensajes de error
const fieldNames: Record<string, string> = {
  nombre: 'Nombre',
  apellidoPaterno: 'Apellido Paterno',
  nss: 'NSS',
  curp: 'CURP',
  rfc: 'RFC',
  fechaNacimiento: 'Fecha de Nacimiento',
  telefono: 'Teléfono',
  email: 'Email',
  puesto: 'Puesto',
  fechaIngreso: 'Fecha de Ingreso',
  salario: 'Salario',
  calle: 'Calle',
  numeroExterior: 'Número Exterior',
  colonia: 'Colonia',
  municipio: 'Municipio',
  estado: 'Estado',
  codigoPostal: 'Código Postal'
};

export default function SystemAdminDashboard() {
  const { user, loading: sessionLoading } = useSessionManager();
  useInactivityManager();

  // Estados para el formulario
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nss: '',
    curp: '',
    rfc: '',
    fechaNacimiento: '',
    genero: '',
    nacionalidad: '',
    estadoCivil: '',
    telefono: '',
    email: '',
    puesto: '',
    departamento: '',
    fechaIngreso: '',
    salario: '',
    horarioLaboral: '',
    tipoContrato: '',
    fechaInicioContrato: '',
    fechaFinContrato: '',
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    colonia: '',
    municipio: '',
    estado: '',
    codigoPostal: '',
    nci: '',
    umf: '',
    salaryIMSS: ''
  });

  // Estado para beneficiarios
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([
    {
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      parentesco: '',
      porcentaje: ''
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successDetails, setSuccessDetails] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Manejar cambios en los inputs del formulario principal
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manejar cambios en los inputs de beneficiarios
  const handleBeneficiarioChange = (index: number, field: keyof Beneficiario, value: string) => {
    const newBeneficiarios = [...beneficiarios];
    newBeneficiarios[index] = {
      ...newBeneficiarios[index],
      [field]: value
    };
    setBeneficiarios(newBeneficiarios);
  };

  // Agregar nuevo beneficiario
  const agregarBeneficiario = () => {
    setBeneficiarios([
      ...beneficiarios,
      {
        nombre: '',
        apellidoPaterno: '',
        apellidoMaterno: '',
        parentesco: '',
        porcentaje: ''
      }
    ]);
  };

  // Eliminar beneficiario
  const eliminarBeneficiario = (index: number) => {
    if (beneficiarios.length > 1) {
      const newBeneficiarios = beneficiarios.filter((_, i) => i !== index);
      setBeneficiarios(newBeneficiarios);
    }
  };

  // Validar formulario
  const validateForm = () => {
    const requiredFields: (keyof FormData)[] = [
      'nombre', 'apellidoPaterno', 'nss', 'curp', 'rfc',
      'fechaNacimiento', 'telefono', 'email', 'puesto',
      'fechaIngreso', 'salario', 'calle', 'numeroExterior',
      'colonia', 'municipio', 'estado', 'codigoPostal'
    ];

    // Validar campos requeridos
    for (const field of requiredFields) {
      if (!formData[field]?.trim()) {
        setErrorMessage(`El campo ${fieldNames[field]} es requerido`);
        return false;
      }
    }

    // Validar formato de CURP (18 caracteres)
    if (formData.curp && formData.curp.length !== 18) {
      setErrorMessage('La CURP debe tener 18 caracteres');
      return false;
    }

    // Validar formato de NSS (11 dígitos)
    if (formData.nss && !/^\d{11}$/.test(formData.nss)) {
      setErrorMessage('El NSS debe tener 11 dígitos');
      return false;
    }

    // Validar RFC (12-13 caracteres)
    if (formData.rfc && (formData.rfc.length < 12 || formData.rfc.length > 13)) {
      setErrorMessage('El RFC debe tener entre 12 y 13 caracteres');
      return false;
    }

    // Validar formato de email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMessage('El email no tiene un formato válido');
      return false;
    }

    // Validar porcentaje total de beneficiarios (debe sumar 100%)
    const porcentajeTotal = beneficiarios.reduce((total, beneficiario) => {
      return total + (parseFloat(beneficiario.porcentaje) || 0);
    }, 0);

    if (beneficiarios.some(b => b.nombre || b.apellidoPaterno)) {
      if (Math.abs(porcentajeTotal - 100) > 0.01) {
        setErrorMessage('El porcentaje total de los beneficiarios debe sumar 100%');
        return false;
      }
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setSuccessDetails(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Filtrar solo beneficiarios que tienen datos
      const beneficiariosFiltrados = beneficiarios.filter(b => 
        b.nombre.trim() && b.apellidoPaterno.trim()
      );

      // Crear objeto con formato correcto para las tablas
      const formDataToSend = {
        // Información personal
        nombre: formData.nombre,
        apellidoPaterno: formData.apellidoPaterno,
        apellidoMaterno: formData.apellidoMaterno,
        fechaNacimiento: formData.fechaNacimiento,
        genero: formData.genero,
        nacionalidad: formData.nacionalidad,
        estadoCivil: formData.estadoCivil,
        telefono: formData.telefono,
        email: formData.email,
        
        // Documentos
        nss: formData.nss,
        curp: formData.curp,
        rfc: formData.rfc,
        nci: formData.nci,
        umf: formData.umf,
        
        // Dirección
        calle: formData.calle,
        numeroExterior: formData.numeroExterior,
        numeroInterior: formData.numeroInterior,
        colonia: formData.colonia,
        municipio: formData.municipio,
        estado: formData.estado,
        codigoPostal: formData.codigoPostal,
        
        // Información laboral
        puesto: formData.puesto,
        departamento: formData.departamento,
        fechaIngreso: formData.fechaIngreso,
        salario: formData.salario,
        horarioLaboral: formData.horarioLaboral,
        tipoContrato: formData.tipoContrato,
        
        // Información de contrato
        fechaInicioContrato: formData.fechaInicioContrato,
        fechaFinContrato: formData.fechaFinContrato,
        salaryIMSS: formData.salaryIMSS,
        
        // Beneficiarios
        beneficiarios: beneficiariosFiltrados
      };

      const response = await fetch('/api/empleados/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formDataToSend),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccessMessage(result.message);
        setSuccessDetails({
          empleadoId: result.empleadoId,
          nombre: `${formData.nombre} ${formData.apellidoPaterno} ${formData.apellidoMaterno}`,
          puesto: formData.puesto,
          fechaRegistro: new Date().toLocaleDateString('es-MX')
        });
        setShowSuccessModal(true);
        
        // Limpiar formulario después de éxito
        setFormData({
          nombre: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          nss: '',
          curp: '',
          rfc: '',
          fechaNacimiento: '',
          genero: '',
          nacionalidad: '',
          estadoCivil: '',
          telefono: '',
          email: '',
          puesto: '',
          departamento: '',
          fechaIngreso: '',
          salario: '',
          horarioLaboral: '',
          tipoContrato: '',
          fechaInicioContrato: '',
          fechaFinContrato: '',
          calle: '',
          numeroExterior: '',
          numeroInterior: '',
          colonia: '',
          municipio: '',
          estado: '',
          codigoPostal: '',
          nci: '',
          umf: '',
          salaryIMSS: ''
        });

        // Limpiar beneficiarios
        setBeneficiarios([{
          nombre: '',
          apellidoPaterno: '',
          apellidoMaterno: '',
          parentesco: '',
          porcentaje: ''
        }]);
      } else {
        setErrorMessage(result.message || 'ERROR AL REGISTRAR EL EMPLEADO. POR FAVOR, INTENTE NUEVAMENTE.');
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      setErrorMessage('ERROR DE CONEXIÓN. POR FAVOR, VERIFIQUE SU CONEXIÓN A INTERNET E INTENTE NUEVAMENTE.');
    } finally {
      setLoading(false);
    }
  };

  // Cerrar modal manualmente (se eliminó el cierre automático)
  const closeModal = () => {
    setShowSuccessModal(false);
  };

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <AppHeader 
        title="PANEL ADMINISTRATIVO"
      />

     {/* MODAL DE CONFIRMACIÓN EXITOSA */}
{showSuccessModal && (
  <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/30">
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-fade-in relative">
      {/* Botón de cerrar en la esquina superior derecha */}
      <button
        onClick={closeModal}
        className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200 z-10"
        aria-label="Cerrar modal"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="p-6 pt-7"> {/* Añadido pt-7 para dar espacio a la X */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            ¡REGISTRO EXITOSO!
          </h3>
          <p className="text-gray-600 mb-4">
            El empleado ha sido registrado correctamente en el sistema.
          </p>
          
          {successDetails && (
            <div className="bg-gray-50 rounded-lg p-4 w-full mb-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-left font-medium text-gray-700">ID Empleado:</div>
                <div className="text-right font-bold text-[#3a6ea5]">{successDetails.empleadoId}</div>
                
                <div className="text-left font-medium text-gray-700">Nombre:</div>
                <div className="text-right truncate">{successDetails.nombre}</div>
                
                <div className="text-left font-medium text-gray-700">Puesto:</div>
                <div className="text-right">{successDetails.puesto}</div>
                
                <div className="text-left font-medium text-gray-700">Fecha de Registro:</div>
                <div className="text-right">{successDetails.fechaRegistro}</div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center space-x-3 w-full">
            <button
              onClick={closeModal}
              className="px-6 py-2 bg-[#3a6ea5] text-white font-medium rounded-md hover:bg-[#2d5592] transition-colors"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

      {/* CONTENT */}
      <main className="w-full px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="bg-[#3a6ea5] p-4 rounded-lg shadow border border-[#3a6ea5] w-full">
              <h1 className="text-xl font-bold text-white tracking-tight">INGRESO / CONTRATACIÓN</h1>
              <p className="text-sm text-gray-200 mt-1">
                Para dar de alta a un nuevo empleado en el sistema, debe completar el formulario correspondiente.
              </p>
            </div>
          </div>

          {/* FORMULARIO DE REGISTRO DE EMPLEADO */}
          <div className="space-y-6">
            {successMessage && !showSuccessModal && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <p className="text-green-700 font-bold text-center uppercase">{successMessage}</p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-700 font-bold text-center uppercase">{errorMessage}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* TARJETA DE INFORMACIÓN PERSONAL */}
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                    <User className="h-5 w-5 mr-2 text-[#3a6ea5]" />
                    INFORMACIÓN PERSONAL
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-6">
                    {/* Nombre completo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NOMBRE(S) *
                        </label>
                        <input
                          type="text"
                          name="nombre"
                          value={formData.nombre}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder='Ingrese el nombre (s)'
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          APELLIDO PATERNO *
                        </label>
                        <input
                          type="text"
                          name="apellidoPaterno"
                          value={formData.apellidoPaterno}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder='Ingrese el apellido paterno'
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          APELLIDO MATERNO
                        </label>
                        <input
                          type="text"
                          name="apellidoMaterno"
                          value={formData.apellidoMaterno}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder='Ingrese el apellido materno'
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE NACIMIENTO *
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <Calendar className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="date"
                            name="fechaNacimiento"
                            value={formData.fechaNacimiento}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Documentos de identificación */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          ESTADO CIVIL
                        </label>
                        <select
                          name="estadoCivil"
                          value={formData.estadoCivil}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        >
                          <option value="">Seleccione un tipo</option>
                          <option value="soltero">Soltero (a)</option>
                          <option value="casado">Casado (a)</option>
                          <option value="divorciado">Divorciado (a)</option>
                          <option value="viudo">Viudo (a)</option>
                          <option value="union_libre">Unión Libre</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          GÉNERO
                        </label>
                        <select
                          name="genero"
                          value={formData.genero}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        >
                          <option value="">Seleccione un tipo</option>
                          <option value="masculino">Masculino</option>
                          <option value="femenino">Femenino</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          TELÉFONO *
                        </label>
                        <input
                          type="text"
                          name="telefono"
                          value={formData.telefono}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el teléfono"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          EMAIL *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el email"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NSS *
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <User className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="text"
                            name="nss"
                            value={formData.nss}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                            placeholder="Ingrese el NSS"
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          CURP *
                        </label>
                        <input
                          type="text"
                          name="curp"
                          value={formData.curp}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium uppercase"
                          placeholder="Ingrese el CURP"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          RFC *
                        </label>
                        <input
                          type="text"
                          name="rfc"
                          value={formData.rfc}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium uppercase"
                          placeholder="Ingrese el RFC"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NÚMERO DE CONVENIO DE INFONAVIT
                        </label>
                        <input
                          type="text"
                          name="nci"
                          value={formData.nci}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese NCI"
                        />
                      </div>
                    </div>

                    {/* Dirección */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          CALLE *
                        </label>
                        <input
                          type="text"
                          name="calle"
                          value={formData.calle}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese la calle"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NO. EXTERIOR *
                        </label>
                        <input
                          type="text"
                          name="numeroExterior"
                          value={formData.numeroExterior}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el número exterior"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NO. INTERIOR
                        </label>
                        <input
                          type="text"
                          name="numeroInterior"
                          value={formData.numeroInterior}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el número interior"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          COLONIA *
                        </label>
                        <input
                          type="text"
                          name="colonia"
                          value={formData.colonia}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese la colonia"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          MUNICIPIO *
                        </label>
                        <input
                          type="text"
                          name="municipio"
                          value={formData.municipio}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el municipio"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          ESTADO *
                        </label>
                        <select
                          name="estado"
                          value={formData.estado}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          required
                        >
                          <option value="">Selecciona un estado</option>
                          <option value="Aguascalientes">Aguascalientes</option>
                          <option value="Baja California">Baja California</option>
                          <option value="Baja California Sur">Baja California Sur</option>
                          <option value="Campeche">Campeche</option>
                          <option value="Chiapas">Chiapas</option>
                          <option value="Chihuahua">Chihuahua</option>
                          <option value="Ciudad de México">Ciudad de México</option>
                          <option value="Coahuila">Coahuila</option>
                          <option value="Colima">Colima</option>
                          <option value="Durango">Durango</option>
                          <option value="Estado de México">Estado de México</option>
                          <option value="Guanajuato">Guanajuato</option>
                          <option value="Guerrero">Guerrero</option>
                          <option value="Hidalgo">Hidalgo</option>
                          <option value="Jalisco">Jalisco</option>
                          <option value="Michoacán">Michoacán</option>
                          <option value="Morelos">Morelos</option>
                          <option value="Nayarit">Nayarit</option>
                          <option value="Nuevo León">Nuevo León</option>
                          <option value="Oaxaca">Oaxaca</option>
                          <option value="Puebla">Puebla</option>
                          <option value="Querétaro">Querétaro</option>
                          <option value="Quintana Roo">Quintana Roo</option>
                          <option value="San Luis Potosí">San Luis Potosí</option>
                          <option value="Sinaloa">Sinaloa</option>
                          <option value="Sonora">Sonora</option>
                          <option value="Tabasco">Tabasco</option>
                          <option value="Tamaulipas">Tamaulipas</option>
                          <option value="Tlaxcala">Tlaxcala</option>
                          <option value="Veracruz">Veracruz</option>
                          <option value="Yucatán">Yucatán</option>
                          <option value="Zacatecas">Zacatecas</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          CÓDIGO POSTAL *
                        </label>
                        <input
                          type="text"
                          name="codigoPostal"
                          value={formData.codigoPostal}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el código postal"
                          required
                        />
                      </div>

                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NACIONALIDAD
                        </label>
                        <select
                          name="nacionalidad"
                          value={formData.nacionalidad}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        >
                          <option value="">Seleccione un tipo</option>
                          <option value="mexicana">Mexicana</option>
                          <option value="extranjera">Extranjera</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          NÚMERO DE UNIDAD DE MEDICINA FAMILIAR
                        </label>
                        <input
                          type="text"
                          name="umf"
                          value={formData.umf}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese UMF"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TARJETA DE DATOS LABORALES */}
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                    INFORMACIÓN LABORAL
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE INGRESO *
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <Calendar className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="date"
                            name="fechaIngreso"
                            value={formData.fechaIngreso}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          PUESTO *
                        </label>
                        <input
                          type="text"
                          name="puesto"
                          value={formData.puesto}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el puesto"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          ÁREA
                        </label>
                        <input
                          type="text"
                          name="departamento"
                          value={formData.departamento}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el área"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          SALARIO *
                        </label>
                        <input
                          type="text"
                          name="salario"
                          value={formData.salario}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          placeholder="Ingrese el salario"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          HORARIO LABORAL
                        </label>
                        <select
                          name="horarioLaboral"
                          value={formData.horarioLaboral}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                        >
                          <option value="">Seleccione un tipo</option>
                          <option value="08:15 am a 06:00 pm">08:15 am a 06:00 pm</option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE INICIO CONTRATO
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <Calendar className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="date"
                            name="fechaInicioContrato"
                            value={formData.fechaInicioContrato}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          FECHA DE FIN CONTRATO
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <Calendar className="h-4 w-4 text-gray-600" />
                          </div>
                          <input
                            type="date"
                            name="fechaFinContrato"
                            value={formData.fechaFinContrato}
                            onChange={handleInputChange}
                            className="w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                          SALARIO IMSS
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            name="salaryIMSS"
                            value={formData.salaryIMSS}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                            placeholder="Ingrese el salario para IMSS"
                            step="0.01"
                         />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* TARJETA DE BENEFICIARIOS */}
              <div className="bg-white rounded-lg shadow border border-gray-300 overflow-hidden mb-6">
                <div className="bg-gray-200 px-6 py-4 border-b-2 border-gray-300">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center">
                      BENEFICIARIOS
                    </h2>
                    <button
                      type="button"
                      onClick={agregarBeneficiario}
                      className="bg-[#3a6ea5] text-white text-sm font-bold py-2 px-4 rounded hover:bg-[#2d5592] transition-colors uppercase"
                    >
                      + Agregar Beneficiario
                    </button>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="space-y-6">
                    {beneficiarios.map((beneficiario, index) => (
                      <div key={index} className="border border-gray-300 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-sm font-bold text-gray-700 uppercase">
                            Beneficiario #{index + 1}
                          </h3>
                          {beneficiarios.length > 1 && (
                            <button
                              type="button"
                              onClick={() => eliminarBeneficiario(index)}
                              className="bg-red-100 text-red-700 text-sm font-bold py-1 px-3 rounded hover:bg-red-200 transition-colors"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              NOMBRE (S) *
                            </label>
                            <input
                              type="text"
                              value={beneficiario.nombre}
                              onChange={(e) => handleBeneficiarioChange(index, 'nombre', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              placeholder="Ingrese el nombre del beneficiario"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              APELLIDO PATERNO *
                            </label>
                            <input
                              type="text"
                              value={beneficiario.apellidoPaterno}
                              onChange={(e) => handleBeneficiarioChange(index, 'apellidoPaterno', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              placeholder="ingrese el apellido paterno"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              APELLIDO MATERNO
                            </label>
                            <input
                              type="text"
                              value={beneficiario.apellidoMaterno}
                              onChange={(e) => handleBeneficiarioChange(index, 'apellidoMaterno', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              placeholder="Ingrese el apellido materno"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              PARENTESCO *
                            </label>
                            <select
                              value={beneficiario.parentesco}
                              onChange={(e) => handleBeneficiarioChange(index, 'parentesco', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              required
                            >
                              <option value="">Seleccionar</option>
                              <option value="conyuge">Cónyuge</option>
                              <option value="hijo">Hijo (a)</option>
                              <option value="padre">Padre</option>
                              <option value="madre">Madre</option>
                              <option value="hermano">Hermano (a)</option>
                              <option value="otro">Otro</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase">
                              PORCENTAJE (%) *
                            </label>
                            <input
                              type="text"
                              value={beneficiario.porcentaje}
                              onChange={(e) => handleBeneficiarioChange(index, 'porcentaje', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm bg-white border border-gray-400 rounded focus:outline-none focus:border-[#3a6ea5] font-medium"
                              placeholder="Ingrese el porcentaje"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* BOTONES */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-[#3a6ea5] text-white font-bold py-3 px-6 rounded-md hover:bg-[#2d5592] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase tracking-tight"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      REGISTRANDO...
                    </>
                  ) : (
                    'REGISTRAR EMPLEADO'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      nombre: '',
                      apellidoPaterno: '',
                      apellidoMaterno: '',
                      nss: '',
                      curp: '',
                      rfc: '',
                      fechaNacimiento: '',
                      genero: '',
                      nacionalidad: '',
                      estadoCivil: '',
                      telefono: '',
                      email: '',
                      puesto: '',
                      departamento: '',
                      fechaIngreso: '',
                      salario: '',
                      horarioLaboral: '',
                      tipoContrato: '',
                      fechaInicioContrato: '',
                      fechaFinContrato: '',
                      calle: '',
                      numeroExterior: '',
                      numeroInterior: '',
                      colonia: '',
                      municipio: '',
                      estado: '',
                      codigoPostal: '',
                      nci: '',
                      umf: '',
                      salaryIMSS: ''
                    });
                    setBeneficiarios([{
                      nombre: '',
                      apellidoPaterno: '',
                      apellidoMaterno: '',
                      parentesco: '',
                      porcentaje: ''
                    }]);
                    setSuccessMessage('');
                    setErrorMessage('');
                    setShowSuccessModal(false);
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 px-6 rounded-md hover:bg-gray-300 transition-colors uppercase tracking-tight"
                >
                  LIMPIAR FORMULARIO
                </button>
              </div>
            </form>
          </div>
        </div>

        <Footer/>
      </main>

      {/* Agregar estilos para animaciones */}
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
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}