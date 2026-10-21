import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHierarchyTree } from '../../api/client';
import { Network, UserCheck, Shield, ChevronRight, Layers } from 'lucide-react';

function TreeNode({ node }) {
  return (
    <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-4 before:bottom-0 before:w-0.5 before:bg-slate-200">
      <div className="flex items-center space-x-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-brand-300 transition group max-w-xl">
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">
          L{node.levelRank}
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="text-xs font-bold text-slate-800">{node.name}</h4>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {node.title}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block">{node.email}</span>
        </div>
        <div className="text-right">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            node.activeCases > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-400'
          }`}>
            {node.activeCases} active cases
          </span>
        </div>
      </div>

      {node.children && node.children.length > 0 && (
        <div className="pl-4 space-y-3">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyTree() {
  const { data, isLoading } = useQuery({
    queryKey: ['hierarchyTree'],
    queryFn: getHierarchyTree
  });

  const roots = data?.tree || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center">
          <Network className="w-6 h-6 mr-2 text-brand-600" />
          Escalation Hierarchy Tree
        </h1>
        <p className="text-xs text-slate-400">
          Visual escalation hierarchy structure: Level 1 Faculty → Level 2 HOD → Level 3 Dean.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading hierarchy tree...</div>
      ) : roots.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-xs text-slate-400">
          No hierarchy nodes found. Ensure faculty members are assigned designations and reports_to links.
        </div>
      ) : (
        <div className="bg-slate-50/50 p-6 sm:p-8 rounded-3xl border border-slate-200/80 space-y-6">
          {roots.map((rootNode) => (
            <TreeNode key={rootNode.id} node={rootNode} />
          ))}
        </div>
      )}
    </div>
  );
}
