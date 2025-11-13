import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Battery, Zap, Clock, TrendingUp, AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';

export default function BatteryAutonomyCalculator() {
  const [batteryType, setBatteryType] = useState('LiFePO4');
  const [voltage, setVoltage] = useState('12');
  const [capacity, setCapacity] = useState('100');
  const [inverterEfficiency, setInverterEfficiency] = useState('90');
  const [inverterIdle, setInverterIdle] = useState('15');
  const [dod, setDod] = useState('80');
  const [loads, setLoads] = useState('100, 200, 300, 500');
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});
  const [isCalculating, setIsCalculating] = useState(false);

  const validateInput = (name, value) => {
    const numValue = parseFloat(value);
    let isValid = true;
    let errorMessage = '';

    switch (name) {
      case 'voltage':
        if (isNaN(numValue) || numValue <= 0) {
          isValid = false;
          errorMessage = 'Напруга повинна бути додатним числом';
        }
        break;
      case 'capacity':
        if (isNaN(numValue) || numValue <= 0) {
          isValid = false;
          errorMessage = 'Ємність повинна бути додатним числом';
        }
        break;
      case 'inverterEfficiency':
        if (isNaN(numValue) || numValue < 0 || numValue > 100) {
          isValid = false;
          errorMessage = 'ККД повинен бути від 0 до 100%';
        }
        break;
      case 'inverterIdle':
        if (isNaN(numValue) || numValue < 0) {
          isValid = false;
          errorMessage = 'Самоспоживання повинно бути додатним числом';
        }
        break;
      case 'dod':
        if (isNaN(numValue) || numValue < 0 || numValue > 100) {
          isValid = false;
          errorMessage = 'DoD повинен бути від 0 до 100%';
        }
        break;
      case 'loads':
        const loadArray = value.split(',').map(l => parseFloat(l.trim())).filter(l => !isNaN(l) && l > 0);
        if (loadArray.length === 0) {
          isValid = false;
          errorMessage = 'Введіть хоча б одне валідне навантаження';
        }
        break;
      default:
        break;
    }

    setErrors(prevErrors => {
      const newErrors = { ...prevErrors };
      if (isValid) {
        delete newErrors[name];
      } else {
        newErrors[name] = errorMessage;
      }
      return newErrors;
    });

    return isValid;
  };

  const calculateAutonomy = useCallback(() => {
    setIsCalculating(true);
    
    // Небольшая задержка для плавной анимации
    setTimeout(() => {
      // Валідація всіх полів
      const voltageValid = validateInput('voltage', voltage);
      const capacityValid = validateInput('capacity', capacity);
      const efficiencyValid = validateInput('inverterEfficiency', inverterEfficiency);
      const idleValid = validateInput('inverterIdle', inverterIdle);
      const dodValid = validateInput('dod', dod);
      const loadsValid = validateInput('loads', loads);

      const isValid = voltageValid && capacityValid && efficiencyValid && idleValid && dodValid && loadsValid;

      if (!isValid) {
        setResults(null);
        setIsCalculating(false);
        return;
      }

    const V = parseFloat(voltage);
    const Ah = parseFloat(capacity);
    const eff = parseFloat(inverterEfficiency) / 100;
    const idle = parseFloat(inverterIdle);
    const dodPercent = parseFloat(dod) / 100;
    
      if (isNaN(V) || isNaN(Ah) || isNaN(eff) || isNaN(idle) || isNaN(dodPercent)) {
        setResults(null);
        setIsCalculating(false);
        return;
      }

      const loadArray = loads.split(',').map(l => parseFloat(l.trim())).filter(l => !isNaN(l) && l > 0);
      
      if (loadArray.length === 0) {
        setResults(null);
        setIsCalculating(false);
        return;
      }

      const E_batt = V * Ah;
      const E_DoD = E_batt * dodPercent;
      const E_inverter = E_DoD * eff;
      
      const loadResults = loadArray.map(load => {
        const P_total = load + idle;
        const hours = P_total > 0 ? E_inverter / P_total : 0;
        
        let note = '';
        let status = 'info';
        if (hours >= 24) {
          note = 'Відмінна автономність';
          status = 'success';
        } else if (hours >= 12) {
          note = 'Достатньо для цілодобової роботи';
          status = 'success';
        } else if (hours >= 6) {
          note = 'Достатньо для денної роботи';
          status = 'warning';
        } else if (hours >= 3) {
          note = 'Короткочасна робота';
          status = 'warning';
        } else {
          note = 'Дуже короткий час роботи';
          status = 'error';
        }
        
        return {
          load,
          hours: hours.toFixed(1),
          hoursRaw: hours,
          note,
          status
        };
      });

      const losses = {
        dod_loss: E_batt - E_DoD,
        inverter_loss: E_DoD - E_inverter,
        total_loss: E_batt - E_inverter
      };

      setResults({
        E_batt: E_batt.toFixed(1),
        E_DoD: E_DoD.toFixed(1),
        E_inverter: E_inverter.toFixed(1),
        losses,
        loadResults
      });
      setIsCalculating(false);
    }, 100);
  }, [voltage, capacity, inverterEfficiency, inverterIdle, dod, loads, batteryType]);

  useEffect(() => {
    calculateAutonomy();
  }, [calculateAutonomy]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && results) {
        e.preventDefault();
        const data = {
          batteryType,
          voltage,
          capacity,
          inverterEfficiency,
          inverterIdle,
          dod,
          loads,
          results: {
            E_batt: results.E_batt,
            E_DoD: results.E_DoD,
            E_inverter: results.E_inverter,
            losses: results.losses,
            loadResults: results.loadResults
          },
          timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `battery-calculation-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, batteryType, voltage, capacity, inverterEfficiency, inverterIdle, dod, loads]);

  const recommendations = useMemo(() => {
    if (!results) return [];
    
    const recommendations = [];
    const avgLoss = (results.losses.total_loss / parseFloat(results.E_batt)) * 100;
    
    if (avgLoss > 30) {
      recommendations.push({
        type: 'warning',
        text: 'Високі втрати енергії! Розгляньте інвертор з вищим ККД.'
      });
    }
    
    if (parseFloat(inverterIdle) > 20) {
      recommendations.push({
        type: 'info',
        text: 'Самоспоживання інвертора суттєве. Вимикайте інвертор коли не потрібен.'
      });
    }
    
    if (parseFloat(dod) > 80 && (batteryType === 'AGM' || batteryType === 'GEL')) {
      recommendations.push({
        type: 'warning',
        text: `Для ${batteryType} акумуляторів рекомендується DoD до 50% для подовження терміну служби.`
      });
    }
    
    if (parseFloat(dod) < 50) {
      recommendations.push({
        type: 'info',
        text: 'Низька глибина розряду збільшує термін служби, але зменшує корисну ємність.'
      });
    }

    // Перевірка мінімального часу роботи
    const minHours = Math.min(...results.loadResults.map(r => r.hoursRaw));
    if (minHours < 3) {
      recommendations.push({
        type: 'error',
        text: 'Час роботи дуже короткий. Розгляньте збільшення ємності акумулятора або зменшення навантаження.'
      });
    }
    
    recommendations.push({
      type: 'success',
      text: 'Для збільшення часу роботи: зменшіть навантаження, збільште ємність акумулятора або використовуйте більш ефективний інвертор.'
    });
    
    return recommendations;
  }, [results, inverterIdle, dod, batteryType]);

  const getRecommendations = () => recommendations;

  const formatNumber = (value) => {
    return parseFloat(value).toLocaleString('uk-UA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const getRecommendationColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  const resetToDefaults = () => {
    setBatteryType('LiFePO4');
    setVoltage('12');
    setCapacity('100');
    setInverterEfficiency('90');
    setInverterIdle('15');
    setDod('80');
    setLoads('100, 200, 300, 500');
    setErrors({});
    setResults(null);
  };

  const exportResults = () => {
    if (!results) return;
    
    const data = {
      batteryType,
      voltage,
      capacity,
      inverterEfficiency,
      inverterIdle,
      dod,
      loads,
      results: {
        E_batt: results.E_batt,
        E_DoD: results.E_DoD,
        E_inverter: results.E_inverter,
        losses: results.losses,
        loadResults: results.loadResults
      },
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battery-calculation-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-8 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Battery className="w-8 h-8" />
                <h1 className="text-2xl md:text-3xl font-bold">Калькулятор автономності</h1>
              </div>
              <div className="flex gap-2">
                {results && (
                  <button
                    onClick={exportResults}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                    title="Експортувати результати (Ctrl+S)"
                    aria-label="Експортувати результати"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={resetToDefaults}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                  title="Скинути до значень за замовчуванням"
                  aria-label="Скинути до значень за замовчуванням"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
            </div>
            <p className="text-blue-100">Розрахунок часу роботи від акумулятора через інвертор</p>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800">
                  <Battery className="w-5 h-5 text-blue-600" />
                  Параметри акумулятора
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Тип акумулятора
                  </label>
                  <select
                    value={batteryType}
                    onChange={(e) => {
                      setBatteryType(e.target.value);
                      // Автоматично встановлюємо рекомендовану напругу та DoD
                      if (e.target.value === 'LiFePO4') {
                        setVoltage('12.8');
                        setDod('85');
                      } else if (e.target.value === 'Li-ion') {
                        setVoltage('12');
                        setDod('80');
                      } else if (e.target.value === 'AGM' || e.target.value === 'GEL') {
                        setVoltage('12');
                        setDod('50');
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="LiFePO4">LiFePO4 (літій-залізо-фосфат)</option>
                    <option value="Li-ion">Li-ion (літій-іонний)</option>
                    <option value="AGM">AGM (свинцево-кислотний)</option>
                    <option value="GEL">GEL (гелевий)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Напруга (В)
                  </label>
                  <select
                    value={voltage}
                    onChange={(e) => {
                      setVoltage(e.target.value);
                      validateInput('voltage', e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.voltage ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="12">12 В</option>
                    <option value="12.8">12.8 В (LiFePO4)</option>
                    <option value="24">24 В</option>
                    <option value="48">48 В</option>
                  </select>
                  {errors.voltage && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.voltage}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ємність (Ah)
                  </label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => {
                      setCapacity(e.target.value);
                      validateInput('capacity', e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.capacity ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="100"
                    min="0"
                    step="0.1"
                  />
                  {errors.capacity && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.capacity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Глибина розряду DoD (%)
                  </label>
                  <input
                    type="number"
                    value={dod}
                    onChange={(e) => {
                      setDod(e.target.value);
                      validateInput('dod', e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.dod ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="80"
                    min="0"
                    max="100"
                    step="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {batteryType === 'LiFePO4' && 'LiFePO4: рекомендовано 80-90%'}
                    {batteryType === 'Li-ion' && 'Li-ion: рекомендовано 80%'}
                    {batteryType === 'AGM' && 'AGM: рекомендовано 50%'}
                    {batteryType === 'GEL' && 'GEL: рекомендовано 50%'}
                  </p>
                  {errors.dod && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.dod}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Параметри інвертора та навантаження
                </h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ККД інвертора (%)
                  </label>
                  <input
                    type="number"
                    value={inverterEfficiency}
                    onChange={(e) => {
                      setInverterEfficiency(e.target.value);
                      validateInput('inverterEfficiency', e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.inverterEfficiency ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="90"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  {errors.inverterEfficiency && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.inverterEfficiency}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Самоспоживання інвертора (Вт)
                  </label>
                  <input
                    type="number"
                    value={inverterIdle}
                    onChange={(e) => {
                      setInverterIdle(e.target.value);
                      validateInput('inverterIdle', e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.inverterIdle ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="15"
                    min="0"
                    step="0.1"
                  />
                  {errors.inverterIdle && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.inverterIdle}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Навантаження (Вт, через кому)
                  </label>
                  <input
                    type="text"
                    value={loads}
                    onChange={(e) => {
                      setLoads(e.target.value);
                      validateInput('loads', e.target.value);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                      errors.loads ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="100, 200, 300, 500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Введіть одне або декілька значень через кому
                  </p>
                  {errors.loads && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.loads}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {Object.keys(errors).length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Будь ласка, виправте помилки в полях вводу для отримання результатів
                </p>
              </div>
            )}

            {isCalculating && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-blue-600">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <span className="text-lg font-medium">Розрахунок...</span>
                </div>
              </div>
            )}

            {results && !isCalculating && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <h3 className="font-semibold text-lg mb-4 text-gray-800">Енергетичний баланс</h3>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-sm text-gray-600 mb-1">Загальна енергія</div>
                      <div className="text-2xl font-bold text-blue-600">{formatNumber(results.E_batt)}</div>
                      <div className="text-xs text-gray-500">Вт·год</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-sm text-gray-600 mb-1">Після DoD</div>
                      <div className="text-2xl font-bold text-green-600">{formatNumber(results.E_DoD)}</div>
                      <div className="text-xs text-gray-500">Вт·год</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-sm text-gray-600 mb-1">Після інвертора</div>
                      <div className="text-2xl font-bold text-orange-600">{formatNumber(results.E_inverter)}</div>
                      <div className="text-xs text-gray-500">Вт·год</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-sm text-gray-600 mb-1">Загальні втрати</div>
                      <div className="text-2xl font-bold text-red-600">{formatNumber(results.losses.total_loss)}</div>
                      <div className="text-xs text-gray-500">Вт·год ({((results.losses.total_loss / parseFloat(results.E_batt)) * 100).toFixed(1)}%)</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-lg flex items-center gap-2 text-gray-800">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      Час роботи для різних навантажень
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Навантаження (Вт)</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Час роботи (год)</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Примітки</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {results.loadResults.map((result, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-gray-900 font-medium">{formatNumber(result.load)} Вт</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(result.status)}`}>
                                {result.hours} год
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-600 text-sm">{result.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-800">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Рекомендації
                  </h3>
                  <ul className="space-y-2">
                    {getRecommendations().map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className={`mt-0.5 ${getRecommendationColor(rec.type)}`}>
                          {rec.type === 'success' ? <CheckCircle className="w-4 h-4" /> : 
                           rec.type === 'error' ? <AlertCircle className="w-4 h-4" /> : '•'}
                        </span>
                        <span>{rec.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 bg-white rounded-lg p-4 shadow-sm">
          <p className="font-medium mb-2">Формули розрахунку:</p>
          <p className="text-xs">
            E_batt = V × Ah | E_DoD = E_batt × DoD | E_inverter = E_DoD × eff | Hours = E_inverter / (Load + idle)
          </p>
        </div>
      </div>
    </div>
  );
}

