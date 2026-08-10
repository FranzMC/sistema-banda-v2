import os
import re

def process_file(filepath, replacements):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    original = content
    for old, new in replacements:
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes needed for {filepath}")

base_dir = r"C:\dev\Sis_Banda\frontend\src"

# 1. Dashboard.jsx
dashboard_reps = [
    ('min-h-screen bg-slate-50/50 p-4 md:p-8', 'min-h-screen bg-slate-50/50 p-3 md:p-5'),
    ('max-w-7xl mx-auto space-y-8', 'max-w-6xl mx-auto space-y-6'),
    ('md:flex-row items-start md:items-center justify-between', 'md:flex-row flex-wrap items-start md:items-center justify-between gap-4'),
    ('text-3xl md:text-4xl font-extrabold', 'text-2xl md:text-3xl font-extrabold'),
    ('p-8 rounded-3xl', 'p-6 rounded-3xl'),
    ('p-8 shadow-sm', 'p-6 shadow-sm'),
    ('bg-white p-8 rounded-3xl', 'bg-white p-6 rounded-3xl'),
    ('bg-white/70 backdrop-blur-md rounded-3xl p-8', 'bg-white/70 backdrop-blur-md rounded-3xl p-6'),
    ('bg-white rounded-3xl shadow-sm p-6', 'bg-white rounded-3xl shadow-sm p-5'),
]
process_file(os.path.join(base_dir, 'pages', 'Dashboard.jsx'), dashboard_reps)

# 2. Eventos.jsx
eventos_reps = [
    ('className="max-w-7xl mx-auto"', 'className="max-w-6xl mx-auto"'),
    ('lg:max-w-6xl', 'lg:max-w-4xl'),
    ('flex px-8 py-4', 'flex flex-wrap px-6 py-4'),
    ('flex items-center justify-between mb-4', 'flex flex-wrap items-center justify-between gap-2 mb-4'),
    ('flex flex-col md:flex-row justify-between', 'flex flex-col md:flex-row flex-wrap justify-between gap-3'),
    ('text-3xl font-bold', 'text-2xl font-bold'),
    ('px-8 py-3 text-lg', 'px-5 py-2.5'),
    ('px-6 py-4 text-lg', 'px-5 py-3'),
    ('px-5 py-4 text-lg', 'px-4 py-3'),
    ('p-16', 'p-8'),
    ('p-8 border-b', 'p-6 border-b'),
    ('p-8 flex-1', 'p-6 flex-1'),
]
process_file(os.path.join(base_dir, 'pages', 'Eventos.jsx'), eventos_reps)

# 3. Finanzas.jsx
finanzas_reps = [
    ('md:flex-row justify-between items-start md:items-center mb-6 gap-4', 'md:flex-row flex-wrap justify-between items-start md:items-center mb-6 gap-4'),
    ('text-3xl font-black', 'text-2xl font-black'),
    ('min-w-[250px]', 'w-full md:w-auto'),
]
process_file(os.path.join(base_dir, 'pages', 'Finanzas.jsx'), finanzas_reps)

# 4. Financiamientos.jsx
financiamientos_reps = [
    ('md:flex-row justify-between items-start md:items-center mb-8 gap-4', 'md:flex-row flex-wrap justify-between items-start md:items-center mb-6 gap-4'),
    ('text-3xl font-bold', 'text-2xl font-bold'),
]
process_file(os.path.join(base_dir, 'pages', 'Financiamientos.jsx'), financiamientos_reps)

# 5. App.jsx
app_reps = [
    ('overflow-hidden min-w-0', 'overflow-x-hidden min-w-0'),
    ('p-4 md:p-6 lg:p-8', 'p-3 md:p-5'),
]
process_file(os.path.join(base_dir, 'App.jsx'), app_reps)
