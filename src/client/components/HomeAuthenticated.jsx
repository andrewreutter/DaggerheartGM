import React, { useEffect, useState } from 'react';
import { MapPinned, Plus, Users } from 'lucide-react';
import { LibraryView } from './LibraryView.jsx';
import { Footer } from './Footer.jsx';
import { fetchPublicTables } from '../lib/api.js';

function CharacterNameChips({ names }) {
  const list = Array.isArray(names) ? names.filter((n) => typeof n === 'string' && n.trim()) : [];
  if (list.length === 0) {
    return <p className="text-[11px] text-dh-muted">No characters yet</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {list.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="max-w-full truncate text-[10px] px-1.5 py-0.5 rounded-full bg-dh-raised border border-dh-border text-dh-muted"
          title={name}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

/** Section width — not viewport — drives 1 / 2 / 3 cards across (@xs 20rem, @xl 36rem). */
const TABLE_SECTION_CLASS = '@container min-w-0 rounded-xl border border-dh-border bg-dh-surface p-5 space-y-3';
const TABLE_CARD_GRID_CLASS = 'grid grid-cols-1 @xs:grid-cols-2 @xl:grid-cols-3 gap-2';
const CREATE_TABLE_CTA_CLASS = 'inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white px-5 py-3 text-sm font-semibold shadow-sm transition-colors';

function TableCard({ title, subtitle, characterCount, characterNames, previewUrl, onClick }) {
  const count = Number.isFinite(characterCount)
    ? characterCount
    : (Array.isArray(characterNames) ? characterNames.length : 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full text-left rounded-xl border border-dh-border bg-dh-canvas/40 hover:bg-dh-hover/60 hover:border-dh-strong overflow-hidden transition-colors"
    >
      <div className="aspect-video bg-dh-raised/60 flex items-center justify-center overflow-hidden">
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <MapPinned size={28} className="text-dh-muted" aria-hidden />
        )}
      </div>
      <div className="p-3">
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
        <CharacterNameChips names={characterNames} />
      </div>
    </button>
  );
}

function tableCardTitle(name) {
  return (name && name.trim() && name !== 'New Table') ? name : 'Game Table';
}

export function HomeAuthenticated({
  myTables = [],
  myRooms = [],
  publicTables = [],
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
  const [publicSearch, setPublicSearch] = useState('');
  const [publicSearchResults, setPublicSearchResults] = useState(null);

  useEffect(() => {
    const q = publicSearch.trim();
    if (!q) {
      setPublicSearchResults(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      fetchPublicTables({ search: q }).then((rows) => {
        if (!cancelled) setPublicSearchResults(Array.isArray(rows) ? rows : []);
      }).catch(() => {
        if (!cancelled) setPublicSearchResults([]);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [publicSearch]);

  const publicList = publicSearch.trim()
    ? (publicSearchResults || [])
    : publicTables;

  return (
    <div className="flex-1 overflow-y-auto bg-dh-canvas p-6 md:p-8 space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-dh mb-4">My Tables</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={TABLE_SECTION_CLASS}>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-dh-muted">Owner</h3>
            {myTables.length === 0 ? (
              <div className="flex flex-col items-start gap-2 py-4">
                <button
                  type="button"
                  onClick={onCreateTable}
                  className={CREATE_TABLE_CTA_CLASS}
                >
                  Create my Free Table
                </button>
                <p className="text-xs text-dh-muted max-w-sm">
                  Your free trial won&apos;t start until you start your first session.
                </p>
              </div>
            ) : (
              <>
                <div className={TABLE_CARD_GRID_CLASS}>
                  {myTables.map((table) => (
                    <TableCard
                      key={table.id}
                      title={tableCardTitle(table.name)}
                      characterCount={table.characterCount}
                      characterNames={table.characterNames}
                      previewUrl={table.previewUrl}
                      onClick={() => navigate(`/table/${table.id}`)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onCreateTable}
                  className={CREATE_TABLE_CTA_CLASS}
                >
                  <Plus size={14} aria-hidden /> Create New Table
                </button>
              </>
            )}
          </div>
          <div className={TABLE_SECTION_CLASS}>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-dh-muted">Player</h3>
            {myRooms.length === 0 ? (
              <p className="text-sm text-dh-muted py-4">You haven&apos;t been invited to any tables yet.</p>
            ) : (
              <div className={TABLE_CARD_GRID_CLASS}>
                {myRooms.map((room) => {
                  const title = tableCardTitle(room.tableName || room.name);
                  return (
                    <TableCard
                      key={room.tableId}
                      title={title}
                      subtitle={room.gmName ? `GM: ${room.gmName}` : null}
                      characterCount={room.characterCount}
                      characterNames={room.characterNames}
                      previewUrl={room.previewUrl}
                      onClick={() => navigate(`/table/${room.tableId}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className={TABLE_SECTION_CLASS}>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-dh-muted">Public</h3>
            <input
              type="search"
              value={publicSearch}
              onChange={(e) => setPublicSearch(e.target.value)}
              placeholder="Search public tables"
              aria-label="Search public tables"
              className="w-full px-2.5 py-1.5 rounded-md bg-dh-raised border border-dh-border text-sm text-dh placeholder:text-dh-muted focus:outline-none focus:border-sky-500"
            />
            {publicList.length === 0 ? (
              <p className="text-sm text-dh-muted py-4">No public tables right now.</p>
            ) : (
              <div className={TABLE_CARD_GRID_CLASS}>
                {publicList.map((table) => (
                  <TableCard
                    key={table.id}
                    title={tableCardTitle(table.name)}
                    subtitle={table.gmName ? `GM: ${table.gmName}` : null}
                    characterCount={table.characterCount}
                    characterNames={table.characterNames}
                    previewUrl={table.previewUrl}
                    onClick={() => navigate(`/table/${table.id}`)}
                  />
                ))}
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

      <Footer navigate={navigate} />
    </div>
  );
}
