import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, CheckCircle2, XCircle, Eye, Edit2, Trash2 } from 'lucide-react';

export function SortableMusicoRow({ musico, index, onVer, onEditar, onEliminar }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: musico.id });

  const userRol = JSON.parse(localStorage.getItem('user'))?.rol;
  const canEdit = !['JEFE_SECCION', 'MUSICO'].includes(userRol);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-blue-50/50 transition-colors ${isDragging ? 'bg-blue-50 shadow-lg' : ''}`}>
      <td className="p-4 text-gray-500 font-medium flex items-center gap-2">
        {canEdit && (
          <button {...attributes} {...listeners} className="cursor-grab hover:text-blue-600 focus:outline-none">
             <GripVertical className="w-5 h-5 text-gray-400" />
          </button>
        )}
        {index + 1}
      </td>
      <td className="p-4 text-gray-800">{musico.documento_identidad || musico.ci}</td>
      <td className="p-4 font-semibold text-gray-800">{musico.nombres} {musico.apellidos}</td>
      <td className="p-4 text-gray-600">{musico.telefono || musico.celular}</td>
      <td className="p-4 text-gray-600">
        <span className="bg-gray-100 text-gray-700 py-1 px-2 rounded-lg text-xs font-medium">{musico.instrumento}</span>
      </td>
      <td className="p-4 text-gray-600 text-sm">
        {musico.talla_camisa || '-'} / {musico.talla_chamarra || '-'} / {musico.numero_calzado || '-'}
      </td>
      <td className="p-4">
        {musico.activo !== false ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3"/> Activo</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3"/> Inactivo</span>
        )}
      </td>
      <td className="p-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => onVer(musico)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalles">
            <Eye className="w-5 h-5" />
          </button>
          {canEdit && (
            <>
              <button onClick={() => onEditar(musico)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar">
                <Edit2 className="w-5 h-5" />
              </button>
              <button onClick={() => onEliminar(musico)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
