import { Button } from './Button';

interface NavigationBarProps {
  currentView: 'add' | 'list' | 'detail' | 'ai-generation' | 'import';
  onNavigate: (view: 'add' | 'list' | 'ai-generation' | 'import') => void;
}

export function NavigationBar({ currentView, onNavigate }: NavigationBarProps) {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">SimpleKitchen</h1>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={() => onNavigate('add')}
              variant={currentView === 'add' ? 'primary' : 'secondary'}
            >
              Add Recipe
            </Button>
            <Button
              onClick={() => onNavigate('ai-generation')}
              variant={currentView === 'ai-generation' ? 'primary' : 'secondary'}
            >
              Generate Recipe
            </Button>
            <Button
              onClick={() => onNavigate('import')}
              variant={currentView === 'import' ? 'primary' : 'secondary'}
            >
              Import Recipe
            </Button>
            <Button
              onClick={() => onNavigate('list')}
              variant={currentView === 'list' ? 'primary' : 'secondary'}
            >
              View Recipes
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
