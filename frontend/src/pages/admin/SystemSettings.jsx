import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSystemSettings,
  updateSystemSetting,
  getCategories,
  createCategory,
  updateCategory,
  getLocations,
  createLocation,
  updateLocation,
  getDesignations,
  createDesignation,
  getAdminUsers
} from '../../api/client';
import { Modal } from '../../components/Modal';
import { SlidersHorizontal, Plus, Check, Shield, MapPin, Tag, Award } from 'lucide-react';
import toast from 'react-hot-toast';

export function SystemSettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('settings');

  // Modals state
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);
  const [newLocation, setNewLocation] = useState({ roomName: '', block: 'SJT', floorNo: 1, locationType: 'CLASSROOM' });

  const [isAddDesignationOpen, setIsAddDesignationOpen] = useState(false);
  const [newDesignation, setNewDesignation] = useState({ title: '', levelRank: 1 });

  // Data fetching
  const { data: settingsData } = useQuery({ queryKey: ['adminSettings'], queryFn: getSystemSettings });
  const { data: categoriesData } = useQuery({ queryKey: ['adminCategories'], queryFn: getCategories });
  const { data: locationsData } = useQuery({ queryKey: ['adminLocations'], queryFn: getLocations });
  const { data: designationsData } = useQuery({ queryKey: ['adminDesignations'], queryFn: getDesignations });
  const { data: facultyUsersData } = useQuery({ queryKey: ['adminFacultyForTheft'], queryFn: () => getAdminUsers({ role: 'FACULTY', pageSize: 100 }) });

  const facultyList = facultyUsersData?.data || [];
  const settingsList = settingsData?.data || [];

  // Mutations
  const updateSettingMutation = useMutation({
    mutationFn: ({ key, value }) => updateSystemSetting(key, value),
    onSuccess: () => {
      toast.success('Setting updated successfully!');
      queryClient.invalidateQueries(['adminSettings']);
    }
  });

  const addCategoryMutation = useMutation({
    mutationFn: (categoryName) => createCategory({ categoryName }),
    onSuccess: () => {
      toast.success('Category added');
      queryClient.invalidateQueries(['adminCategories']);
      setIsAddCategoryOpen(false);
      setNewCategoryName('');
    }
  });

  const addLocationMutation = useMutation({
    mutationFn: (data) => createLocation(data),
    onSuccess: () => {
      toast.success('Location added');
      queryClient.invalidateQueries(['adminLocations']);
      setIsAddLocationOpen(false);
      setNewLocation({ roomName: '', block: 'SJT', floorNo: 1, locationType: 'CLASSROOM' });
    }
  });

  const addDesignationMutation = useMutation({
    mutationFn: (data) => createDesignation(data),
    onSuccess: () => {
      toast.success('Designation added');
      queryClient.invalidateQueries(['adminDesignations']);
      setIsAddDesignationOpen(false);
      setNewDesignation({ title: '', levelRank: 1 });
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Settings & Master Data</h1>
        <p className="text-xs text-slate-400">
          Configure demo SLA deadlines, designate the university theft handler, and manage master catalogs.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        {[
          { id: 'settings', label: 'System Deadlines & Variables', icon: SlidersHorizontal },
          { id: 'categories', label: 'Item Categories', icon: Tag },
          { id: 'designations', label: 'Hierarchy Designations', icon: Award }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center px-4 py-2.5 text-xs font-bold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 mr-1.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="space-y-4">
            {settingsList.map((s) => (
              <div key={s.settingKey} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                  <span className="font-mono text-xs font-bold text-slate-800">{s.settingKey}</span>
                  <p className="text-xs text-slate-500">{s.description}</p>
                </div>

                <div className="flex items-center space-x-2">
                  {s.settingKey === 'theft_handler_user_id' ? (
                    <select
                      value={s.settingValue}
                      onChange={(e) => updateSettingMutation.mutate({ key: s.settingKey, value: e.target.value })}
                      className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">None Selected</option>
                      {facultyList.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.fullName} ({f.designation || 'Faculty'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      defaultValue={s.settingValue}
                      onBlur={(e) => {
                        if (e.target.value !== s.settingValue) {
                          updateSettingMutation.mutate({ key: s.settingKey, value: e.target.value });
                        }
                      }}
                      className="w-48 px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white font-mono"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800">Item Categories Catalog</h2>
            <button
              onClick={() => setIsAddCategoryOpen(true)}
              className="inline-flex items-center px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categoriesData?.data?.map((c) => (
              <div key={c.categoryId} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{c.categoryName}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      )}



      {/* Designations Tab */}
      {activeTab === 'designations' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-800">Faculty Designations & Rank Hierarchy</h2>
            <button
              onClick={() => setIsAddDesignationOpen(true)}
              className="inline-flex items-center px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl transition"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Designation
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {designationsData?.data?.map((d) => (
              <div key={d.designationId} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 block">{d.title}</span>
                  <span className="text-[10px] text-slate-400 block">Hierarchy Level {d.levelRank}</span>
                </div>
                <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 font-bold flex items-center justify-center">
                  L{d.levelRank}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {isAddCategoryOpen && (
        <Modal isOpen={isAddCategoryOpen} onClose={() => setIsAddCategoryOpen(false)} title="Add Item Category">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCategoryMutation.mutate(newCategoryName);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category Name *</label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Lab Equipment"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addCategoryMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}



      {/* Add Designation Modal */}
      {isAddDesignationOpen && (
        <Modal isOpen={isAddDesignationOpen} onClose={() => setIsAddDesignationOpen(false)} title="Add Designation">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addDesignationMutation.mutate({
                title: newDesignation.title,
                levelRank: parseInt(newDesignation.levelRank, 10)
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={newDesignation.title}
                onChange={(e) => setNewDesignation({ ...newDesignation, title: e.target.value })}
                placeholder="Associate Dean"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Level Rank (Number &gt; 0) *</label>
              <input
                type="number"
                min={1}
                required
                value={newDesignation.levelRank}
                onChange={(e) => setNewDesignation({ ...newDesignation, levelRank: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddDesignationOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addDesignationMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
