import React from 'react';
import { Plus, Users } from 'lucide-react';
import { LibraryView } from './LibraryView.jsx';

function playerLabel(player) {
  if (!player) return '';
  const name = typeof player.name === 'string' ? player.name.trim() : '';
  if (name) return name;
  const email = typeof player.email === 'string' ? player.email.trim() : '';
  return email;
}

function PlayerChips({ players }) {
  const list = Array.isArray(players) ? players : [];
  if (list.length === 0) {
    return <p className="text-[11px] text-dh-muted">No players yet</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((player, i) => {
        const label = playerLabel(player);
        if (!label) return null;
        return (
          <span
            key={player.email || `${label}-${i}`}
            className="max-w-full truncate text-[10px] px-1.5 py-0.5 rounded-full bg-dh-raised border border-dh-border text-dh-muted"
            title={player.email || label}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

function TableCard({ title, subtitle, playerCount, players, onClick }) {
  const count = Number.isFinite(playerCount) ? playerCount : (Array.isArray(players) ? players.length : 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-dh-border bg-dh-canvas/40 hover:bg-dh-hover/60 hover:border-dh-strong p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-dh truncate">{title}</p>
          {subtitle && <p className="text-xs text-dh-muted truncate mt-0.5">{subtitle}</p>}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-mono text-dh-muted">
          <Users size={12} aria-hidden />
          {count}
        </span>
      </div>
      <PlayerChips players={players} />
    </button>
  );
}

export function HomeAuthenticated({
  myTables = [],
  myRooms = [],
  onCreateTable,
  navigate,
  data,
  saveItem,
  saveImage,
  deleteItem,
  cloneItem,
  addToTable,
  route,
  isAdmin,
  partySize,
  partyTier,
  characters,
  userUid,
  onItemsChange,
  onMergeAdversary,
  ensureAdventuresLoaded,
  ensureCharactersLoaded,
  libraryKey,
  onRequireAuth,
  libraryCardDimensions = null,
  onLibraryCardDimensionsChange,
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-dh-canvas p-6 md:p-8 space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-dh mb-4">My Tables</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-dh-border bg-dh-surface p-5 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-dh-muted">Owner</h3>
            {myTables.length === 0 ? (
              <div className="flex flex-col items-start gap-2 py-4">
                <button
                  type="button"
                  onClick={onCreateTable}
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-5 py-3 text-sm font-semibold shadow-sm transition-colors"
                >
                  Create my Free Table
                </button>
                <p className="text-xs text-dh-muted max-w-sm">
                  Your free trial won&apos;t start until you start your first session.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {myTables.map((table) => (
                    <TableCard
                      key={table.id}
                      title={(table.name && table.name.trim() && table.name !== 'New Table') ? table.name : 'Game Table'}
                      playerCount={table.playerCount}
                      players={table.players}
                      onClick={() => navigate(`/table/${table.id}`)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onCreateTable}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-dh-muted hover:text-dh px-2 py-1.5 rounded-md hover:bg-dh-raised/50 transition-colors"
                >
                  <Plus size={14} aria-hidden /> Create New Table
                </button>
              </>
            )}
          </div>
          <div className="rounded-xl border border-dh-border bg-dh-surface p-5 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-dh-muted">Player</h3>
            {myRooms.length === 0 ? (
              <p className="text-sm text-dh-muted py-4">You haven&apos;t been invited to any tables yet.</p>
            ) : (
              <div className="space-y-2">
                {myRooms.map((room) => {
                  const title = (room.tableName && room.tableName.trim() && room.tableName !== 'New Table')
                    ? room.tableName
                    : (room.gmName ? `${room.gmName}'s Game Table` : 'Game Table');
                  return (
                    <TableCard
                      key={room.tableId}
                      title={title}
                      subtitle={room.gmName ? `GM: ${room.gmName}` : null}
                      playerCount={room.playerCount}
                      players={room.players}
                      onClick={() => navigate(`/table/${room.tableId}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-dh mb-4">My Library</h2>
        <div className="h-[70vh] overflow-hidden flex flex-col">
          <LibraryView
            key={libraryKey}
            embedded={true}
            isAuthenticated={true}
            onRequireAuth={onRequireAuth}
            userUid={userUid}
            data={data}
            saveItem={saveItem}
            saveImage={saveImage}
            deleteItem={deleteItem}
            cloneItem={cloneItem}
            addToTable={addToTable}
            route={route}
            navigate={navigate}
            onItemsChange={onItemsChange}
            onMergeAdversary={onMergeAdversary}
            isAdmin={isAdmin}
            partySize={partySize}
            partyTier={partyTier}
            characters={characters}
            ensureAdventuresLoaded={ensureAdventuresLoaded}
            ensureCharactersLoaded={ensureCharactersLoaded}
            myTables={myTables}
            libraryCardDimensions={libraryCardDimensions}
            onLibraryCardDimensionsChange={onLibraryCardDimensionsChange}
          />
        </div>
      </section>
    </div>
  );
}
