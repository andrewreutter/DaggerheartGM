-- Remove per-user private map cameras (replaced by table_state mapViews + player free explore).
DROP TABLE IF EXISTS personal_map_cameras;
